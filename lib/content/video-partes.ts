import type { createServerClient } from "@/lib/supabase"
import { generateImage, getImageTaskResult } from "@/lib/content/kie-image"
import { generateMusic, getMusicDetails } from "@/lib/suno/client"
import { generateSongLyrics } from "@/lib/content/song-lyrics"
import { gerarNarracao, type VozId } from "@/lib/content/narracao"
import { logContentEvent } from "@/lib/content/events"

type DB = ReturnType<typeof createServerClient>
const BUCKET = "content-media"

// Troca de UMA parte do vídeo, preservando o resto.
//
// É a diferença entre corrigir e recomeçar: quando a narração ficou boa e só a
// cena 2 saiu errada, refazer o vídeo inteiro joga fora a voz, a música e as
// outras cenas — todas geradas e pagas. Aqui cada ingrediente é substituível
// sozinho, e o vídeo é remontado depois com o que sobrou intacto.

async function pegarJob(supabase: DB, draftId: string) {
  const { data: job } = await supabase
    .from("video_jobs")
    .select("*")
    .eq("contentDraftId", draftId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!job) throw new Error("Não há vídeo para este rascunho.")
  return job
}

/** Marca o job como pronto pro worker montar de novo. */
async function pedirRemontagem(supabase: DB, jobId: string, patch: Record<string, unknown>) {
  const { data } = await supabase
    .from("video_jobs")
    .update({ ...patch, status: "pronto_pra_renderizar", error: null, claimed_at: null })
    .eq("id", jobId)
    .select("*")
    .single()
  return data
}

/** Gera uma imagem na KIE e espera ficar pronta (a geração leva ~30 a 90s). */
async function gerarImagemDeCena(descricao: string, aspecto: "9:16" | "16:9"): Promise<Buffer> {
  const taskId = await generateImage({
    prompt:
      `Fotografia realista, estilo editorial/lifestyle, câmera DSLR, luz natural. Pessoas ` +
      `brasileiras com pele e expressões naturais e genuínas, nada de aparência 3D ou pintura ` +
      `digital — parece uma foto tirada de verdade, não uma ilustração. ${descricao}. ` +
      `NÃO escreva nenhum texto, palavra ou legenda na imagem.`,
    aspectRatio: aspecto,
  })

  for (let i = 0; i < 40; i++) {
    const r = await getImageTaskResult(taskId)
    if (r.state === "success" && r.imageUrl) {
      return Buffer.from(await (await fetch(r.imageUrl)).arrayBuffer())
    }
    if (r.state === "fail") throw new Error(r.failMsg ?? "A KIE não conseguiu gerar a cena.")
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error("Tempo esgotado esperando a imagem da cena.")
}

/** Substitui a imagem (e opcionalmente os textos) de uma cena específica. */
export async function trocarCena(
  supabase: DB,
  draftId: string,
  indice: number,
  descricao?: string,
  legenda?: string,
) {
  const job = await pegarJob(supabase, draftId)
  const receita = job.recipe as { scenes: { description: string; caption: string }[]; platform?: string }
  const cenas = receita.scenes ?? []
  if (!Number.isInteger(indice) || indice < 0 || indice >= cenas.length) {
    throw new Error("Cena inexistente.")
  }
  if (!job.scene_image_urls?.length) {
    throw new Error("Os ingredientes deste vídeo já foram descartados (a peça foi publicada).")
  }

  const cena = { ...cenas[indice] }
  if (typeof descricao === "string" && descricao.trim()) cena.description = descricao.trim()
  if (typeof legenda === "string" && legenda.trim()) cena.caption = legenda.trim()

  const aspecto = receita.platform === "youtube" ? "16:9" : "9:16"
  const bytes = await gerarImagemDeCena(cena.description, aspecto)

  // Caminho novo a cada troca: sobrescrever mantém a URL antiga em cache no
  // navegador e o admin acharia que nada mudou.
  const path = `video-jobs/${job.id}/scene-${indice + 1}-${Date.now()}.png`
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "image/png", upsert: true })
  if (error) throw new Error(`Falha ao subir a cena: ${error.message}`)
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

  const urls = [...job.scene_image_urls]
  urls[indice] = url
  const novasCenas = [...cenas]
  novasCenas[indice] = cena

  await logContentEvent(supabase, draftId, "imagem_gerada", `cena ${indice + 1} refeita`)
  const atualizado = await pedirRemontagem(supabase, job.id, {
    scene_image_urls: urls,
    recipe: { ...receita, scenes: novasCenas },
  })
  return { job: atualizado }
}

/** Regrava a narração (texto e/ou voz), mantendo cenas e música. */
export async function trocarNarracao(supabase: DB, draftId: string, texto?: string, voz?: string) {
  const job = await pegarJob(supabase, draftId)
  const receita = job.recipe as { narracaoTexto?: string; narracaoVoz?: string }

  const textoFinal = (texto ?? receita.narracaoTexto ?? "").trim()
  if (!textoFinal) throw new Error("Escreva o texto da narração.")
  const vozFinal = (voz ?? receita.narracaoVoz ?? "Kore") as VozId

  const wav = await gerarNarracao(textoFinal, vozFinal)
  const path = `video-jobs/${job.id}/narracao-${Date.now()}.wav`
  const { error } = await supabase.storage.from(BUCKET).upload(path, wav, { contentType: "audio/wav", upsert: true })
  if (error) throw new Error(`Falha ao subir a narração: ${error.message}`)
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

  await logContentEvent(supabase, draftId, "rascunho_criado", "narração refeita")
  const atualizado = await pedirRemontagem(supabase, job.id, {
    narration_url: url,
    recipe: { ...receita, narracaoTexto: textoFinal, narracaoVoz: vozFinal },
  })
  return { job: atualizado }
}

/**
 * Troca a trilha. Do catálogo é instantâneo (a música já existe); nova no Suno
 * leva minutos, então devolve o job aguardando e quem descobre que ficou pronta
 * é o polling da tela (sincronizarMusicaNova).
 */
export async function trocarMusica(supabase: DB, draftId: string, origem: "pedido" | "suno", orderId?: string) {
  const job = await pegarJob(supabase, draftId)
  const receita = job.recipe as { songTheme?: string; songStyle?: string }

  if (origem === "pedido") {
    if (!orderId) throw new Error("Escolha de qual pedido vem a música.")
    const { data: order } = await supabase
      .from("orders").select("publication_consent").eq("id", orderId).maybeSingle()
    if (!order?.publication_consent) throw new Error("Esse pedido não autoriza publicação.")

    const { data: music } = await supabase
      .from("generated_music").select("mp3Url").eq("orderId", orderId).maybeSingle()
    if (!music?.mp3Url) throw new Error("Esse pedido não tem música entregue.")

    await logContentEvent(supabase, draftId, "rascunho_criado", "trilha trocada por música de pedido")
    const atualizado = await pedirRemontagem(supabase, job.id, { song_url: music.mp3Url, song_task_id: null })
    return { job: atualizado }
  }

  const { title, lyrics } = await generateSongLyrics(receita.songTheme ?? "", receita.songStyle ?? "")
  const taskId = await generateMusic({
    prompt: lyrics,
    style: receita.songStyle ?? "",
    title,
    vocalGender: "f",
    model: "V5",
    callBackUrl: "https://fizmusica.com.br/api/suno/callback-not-used-polling-instead",
  })

  // song_url zerado + task preenchida = "aguardando música nova".
  const { data: atualizado } = await supabase
    .from("video_jobs")
    .update({ song_task_id: taskId, song_url: null, error: null })
    .eq("id", job.id)
    .select("*")
    .single()

  await logContentEvent(supabase, draftId, "rascunho_criado", "música nova solicitada ao Suno")
  return { job: atualizado, aguardando: "musica" }
}

/** Verifica se a música nova ficou pronta; quando fica, pede a remontagem. */
export async function sincronizarMusicaNova(supabase: DB, jobId: string) {
  const { data: job } = await supabase.from("video_jobs").select("*").eq("id", jobId).maybeSingle()
  if (!job?.song_task_id || job.song_url) return job

  const detalhes: any = await getMusicDetails(job.song_task_id)
  const status = detalhes?.data?.status
  if (status && /FAIL|ERROR|SENSITIVE/i.test(status)) {
    const { data } = await supabase
      .from("video_jobs")
      .update({ status: "falhou", error: `Falha ao gerar a música (${status}).` })
      .eq("id", jobId).select("*").single()
    return data
  }
  if (status !== "SUCCESS") return job

  const track = detalhes?.data?.response?.sunoData?.[0]
  if (!track?.audioUrl) return job

  const bytes = Buffer.from(await (await fetch(track.audioUrl)).arrayBuffer())
  const path = `video-jobs/${jobId}/song-${Date.now()}.mp3`
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "audio/mpeg", upsert: true })
  if (error) throw new Error(`Falha ao subir a música: ${error.message}`)
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

  return pedirRemontagem(supabase, jobId, { song_url: url, song_task_id: null })
}
