import type { createServerClient } from "@/lib/supabase"
import { generateImage, getImageTaskResult, type ImageTaskResult } from "@/lib/content/kie-image"
import { generateMusic, getMusicDetails } from "@/lib/suno/client"
import { generateSongLyrics } from "@/lib/content/song-lyrics"
import { gerarNarracao, type VozId } from "@/lib/content/narracao"
import { logContentEvent } from "@/lib/content/events"
import { garantirMidiaPropria } from "@/lib/content/guardas"

type DB = ReturnType<typeof createServerClient>

export type VideoScene = { description: string; caption: string }
export type VideoRecipe = {
  scenes: VideoScene[]
  songTheme: string
  songStyle: string
  platform: string
  /**
   * De onde vem o áudio do vídeo:
   *   "suno"   → gera uma música nova (padrão, único caminho pra tema livre)
   *   "pedido" → usa a MÚSICA REAL entregue ao cliente daquele pedido. Mais
   *              autêntico (é a canção que existiu de verdade), sai de graça
   *              (não gasta geração no Suno) e o worker já corta no refrão
   *              sozinho — o detectClimaxStart acha a janela mais alta da
   *              faixa, que é justamente onde o refrão está.
   */
  songSource?: "suno" | "pedido" | "narracao"
  /** Pedido cuja música entregue será a trilha (quando songSource="pedido"). Padrão: o pedido que originou o rascunho. */
  songOrderId?: string
  /** Texto lido pela voz sintética (quando songSource="narracao"). */
  narracaoTexto?: string
  narracaoVoz?: string
  /** Música de fundo sob a narração: nenhuma, uma já criada, ou uma nova. */
  narracaoFundo?: "nenhum" | "pedido" | "suno"
}

// Localiza a música entregue ao cliente do pedido que originou o rascunho.
// Exige consentimento de publicação vigente: a peça usa uma obra feita para
// uma pessoa real, e essa checagem não pode depender só da tela.
async function musicaDoPedido(supabase: DB, draftId: string, orderIdEscolhido?: string): Promise<string> {
  let orderId = orderIdEscolhido
  if (!orderId) {
    const { data: draft } = await supabase
      .from("content_drafts")
      .select("sourceOrderId")
      .eq("id", draftId)
      .maybeSingle()
    orderId = draft?.sourceOrderId ?? undefined
  }
  if (!orderId) {
    throw new Error("Escolha de qual pedido vem a música (ou gere uma nova).")
  }

  const { data: order } = await supabase
    .from("orders")
    .select("publication_consent")
    .eq("id", orderId)
    .maybeSingle()
  if (!order?.publication_consent) {
    throw new Error("O cliente não autoriza a publicação — não é possível usar a música dele.")
  }

  const { data: music } = await supabase
    .from("generated_music")
    .select("mp3Url")
    .eq("orderId", orderId)
    .maybeSingle()
  if (!music?.mp3Url) throw new Error("O pedido ainda não tem música entregue.")

  return music.mp3Url
}

// Cria o job e dispara a geração assíncrona dos ingredientes (N imagens KIE +
// letra/música Suno). Não monta o vídeo — isso é trabalho do worker local
// (ffmpeg não roda no Vercel). Ver scripts/video-worker/README.md.
export async function createVideoJob(supabase: DB, draftId: string, recipe: VideoRecipe) {
  if (recipe.scenes.length < 3 || recipe.scenes.length > 6) {
    throw new Error("A receita precisa ter entre 3 e 6 cenas.")
  }

  const { data: job, error } = await supabase
    .from("video_jobs")
    .insert({ contentDraftId: draftId, status: "gerando_ingredientes", recipe })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await logContentEvent(supabase, draftId, "rascunho_criado", "vídeo: ingredientes solicitados")

  // Dispara as N imagens de cena (fotorrealistas, sem texto — o texto é
  // sobreposto depois pelo worker, mesmo princípio do post estático).
  const imageTaskIds = await Promise.all(
    recipe.scenes.map((scene) =>
      generateImage({
        prompt:
          `Fotografia realista, estilo editorial/lifestyle, câmera DSLR, luz natural. Pessoas ` +
          `brasileiras com pele e expressões naturais e genuínas, nada de aparência 3D ou pintura ` +
          `digital — parece uma foto tirada de verdade, não uma ilustração. ${scene.description}. ` +
          `NÃO escreva nenhum texto, palavra ou legenda na imagem.`,
        aspectRatio: "2:3",
      }),
    ),
  )

  // Áudio: ou a música real do pedido, ou uma nova gerada no Suno.
  if (recipe.songSource === "narracao") {
    const wav = await gerarNarracao(recipe.narracaoTexto ?? "", (recipe.narracaoVoz ?? "Kore") as VozId)
    const path = `video-jobs/${job.id}/narracao.wav`
    const { error: upErr } = await supabase.storage
      .from("content-media")
      .upload(path, wav, { contentType: "audio/wav", upsert: true })
    if (upErr) throw new Error(`Falha ao subir a narração: ${upErr.message}`)
    const narrationUrl = supabase.storage.from("content-media").getPublicUrl(path).data.publicUrl

    const fundo = recipe.narracaoFundo ?? "nenhum"

    // Fundo vindo de música já criada: já está pronta, nada a esperar.
    if (fundo === "pedido") {
      const songUrl = await musicaDoPedido(supabase, draftId, recipe.songOrderId)
      await supabase
        .from("video_jobs")
        .update({ scene_image_task_ids: imageTaskIds, narration_url: narrationUrl, song_url: songUrl })
        .eq("id", job.id)
      await logContentEvent(supabase, draftId, "rascunho_criado", "vídeo: narração sobre música já criada")
      return { ...job, scene_image_task_ids: imageTaskIds, narration_url: narrationUrl, song_url: songUrl }
    }

    // Fundo gerado agora: entra na mesma espera das imagens (polling do Suno).
    if (fundo === "suno") {
      const { title, lyrics } = await generateSongLyrics(recipe.songTheme, recipe.songStyle)
      const songTaskId = await generateMusic({
        prompt: lyrics,
        style: recipe.songStyle,
        title,
        vocalGender: "f",
        model: "V5",
        callBackUrl: "https://fizmusica.com.br/api/suno/callback-not-used-polling-instead",
      })
      await supabase
        .from("video_jobs")
        .update({ scene_image_task_ids: imageTaskIds, narration_url: narrationUrl, song_task_id: songTaskId })
        .eq("id", job.id)
      await logContentEvent(supabase, draftId, "rascunho_criado", "vídeo: narração sobre música nova")
      return { ...job, scene_image_task_ids: imageTaskIds, narration_url: narrationUrl, song_task_id: songTaskId }
    }

    await supabase
      .from("video_jobs")
      .update({ scene_image_task_ids: imageTaskIds, narration_url: narrationUrl })
      .eq("id", job.id)
    await logContentEvent(supabase, draftId, "rascunho_criado", "vídeo: trilha narrada, sem música de fundo")
    return { ...job, scene_image_task_ids: imageTaskIds, narration_url: narrationUrl }
  }

  if (recipe.songSource === "pedido") {
    const songUrl = await musicaDoPedido(supabase, draftId, recipe.songOrderId)
    await supabase
      .from("video_jobs")
      .update({ scene_image_task_ids: imageTaskIds, song_url: songUrl })
      .eq("id", job.id)
    await logContentEvent(supabase, draftId, "rascunho_criado", "vídeo: usando a música real do pedido")
    return { ...job, scene_image_task_ids: imageTaskIds, song_url: songUrl }
  }

  const { title, lyrics } = await generateSongLyrics(recipe.songTheme, recipe.songStyle)
  const songTaskId = await generateMusic({
    prompt: lyrics,
    style: recipe.songStyle,
    title,
    vocalGender: "f",
    model: "V5",
    callBackUrl: "https://fizmusica.com.br/api/suno/callback-not-used-polling-instead",
  })

  await supabase
    .from("video_jobs")
    .update({ scene_image_task_ids: imageTaskIds, song_task_id: songTaskId })
    .eq("id", job.id)

  return { ...job, scene_image_task_ids: imageTaskIds, song_task_id: songTaskId }
}

// URLs da KIE expiram — as imagens precisam virar arquivo nosso antes que o
// worker vá buscá-las. Compartilhado pelos dois caminhos de áudio.
async function subirImagensDeCena(
  supabase: DB,
  jobId: string,
  imageResults: ImageTaskResult[],
): Promise<string[]> {
  return Promise.all(
    imageResults.map(async (r, i) => {
      const bytes = Buffer.from(await (await fetch(r.imageUrl!)).arrayBuffer())
      const path = `video-jobs/${jobId}/scene-${i + 1}.png`
      const { error: upErr } = await supabase.storage
        .from("content-media")
        .upload(path, bytes, { contentType: "image/png", upsert: true })
      if (upErr) throw new Error(`Falha ao subir imagem de cena: ${upErr.message}`)
      return supabase.storage.from("content-media").getPublicUrl(path).data.publicUrl
    }),
  )
}

// Consulta o progresso dos ingredientes; quando tudo estiver pronto, baixa e
// sobe pro bucket content-media e marca o job como pronto pro worker renderizar.
export async function syncVideoIngredients(supabase: DB, jobId: string) {
  const { data: job } = await supabase.from("video_jobs").select("*").eq("id", jobId).maybeSingle()
  if (!job) throw new Error("Job não encontrado.")
  if (job.status !== "gerando_ingredientes") return job

  const imageTaskIds: string[] = job.scene_image_task_ids ?? []
  const imageResults = await Promise.all(imageTaskIds.map((id) => getImageTaskResult(id)))

  const anyImageFailed = imageResults.some((r) => r.state === "fail")
  if (anyImageFailed) {
    const msg = "Falha ao gerar uma ou mais imagens de cena."
    await supabase.from("video_jobs").update({ status: "falhou", error: msg }).eq("id", jobId)
    await logContentEvent(supabase, job.contentDraftId, "imagem_falhou", msg)
    return { ...job, status: "falhou", error: msg }
  }

  const imagesReady = imageResults.every((r) => r.state === "success")

  // Música vinda do pedido já está pronta desde a criação: não há o que
  // esperar do Suno, só as imagens.
  if ((job.song_url || job.narration_url) && !job.song_task_id) {
    if (!imagesReady) return job
    const sceneImageUrls = await subirImagensDeCena(supabase, jobId, imageResults)
    const { data: updated, error } = await supabase
      .from("video_jobs")
      .update({ scene_image_urls: sceneImageUrls, status: "pronto_pra_renderizar" })
      .eq("id", jobId)
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    await logContentEvent(supabase, job.contentDraftId, "imagem_gerada", "vídeo: ingredientes prontos (música do pedido)")
    return updated
  }

  const songDetails: any = await getMusicDetails(job.song_task_id)
  const songStatus = songDetails?.data?.status
  const songReady = songStatus === "SUCCESS"

  if (songStatus && /FAIL|ERROR|SENSITIVE/i.test(songStatus)) {
    const msg = `Falha ao gerar a música (${songStatus}).`
    await supabase.from("video_jobs").update({ status: "falhou", error: msg }).eq("id", jobId)
    return { ...job, status: "falhou", error: msg }
  }

  if (!imagesReady || !songReady) return job // ainda gerando

  // Baixa tudo e sobe pro bucket (URLs temporárias da KIE/Suno expiram).
  const sceneImageUrls = await subirImagensDeCena(supabase, jobId, imageResults)
  garantirMidiaPropria(sceneImageUrls, "Montagem de vídeo bloqueada")

  const track = songDetails?.data?.response?.sunoData?.[0]
  if (!track?.audioUrl) throw new Error("Suno não retornou áudio.")
  const songBytes = Buffer.from(await (await fetch(track.audioUrl)).arrayBuffer())
  const songPath = `video-jobs/${jobId}/song.mp3`
  const { error: songUpErr } = await supabase.storage
    .from("content-media")
    .upload(songPath, songBytes, { contentType: "audio/mpeg", upsert: true })
  if (songUpErr) throw new Error(`Falha ao subir a música: ${songUpErr.message}`)
  const songUrl = supabase.storage.from("content-media").getPublicUrl(songPath).data.publicUrl

  const { data: updated, error } = await supabase
    .from("video_jobs")
    .update({ scene_image_urls: sceneImageUrls, song_url: songUrl, status: "pronto_pra_renderizar" })
    .eq("id", jobId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await logContentEvent(supabase, job.contentDraftId, "imagem_gerada", "vídeo: ingredientes prontos, aguardando worker")
  return updated
}
