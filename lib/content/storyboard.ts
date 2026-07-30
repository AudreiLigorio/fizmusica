import type { createServerClient } from "@/lib/supabase"
import { generateImage, getImageTaskResult } from "@/lib/content/kie-image"
import { generateMusic, getMusicDetails } from "@/lib/suno/client"
import { generateSongLyrics } from "@/lib/content/song-lyrics"
import { gerarNarracao, type VozId } from "@/lib/content/narracao"
import { logContentEvent } from "@/lib/content/events"

type DB = ReturnType<typeof createServerClient>
const BUCKET = "content-media"

// Storyboard — a inversão da ordem antiga.
//
// Antes: uma tacada só gerava imagens + música + narração e montava o MP4. Você
// só descobria que a cena 2 estava errada depois de tudo pronto, e corrigir
// significava refazer o conjunto.
//
// Agora o vídeo nasce em três etapas com você no meio:
//   1. storyboard → gera SÓ as imagens; você vê cena por cena e refaz o que quiser
//   2. áudio      → narração e/ou trilha, com prévia
//   3. compilar   → só aqui o worker monta o MP4
//
// A consistência de personagem sai da etapa 1: a cena 1 é gerada primeiro e
// entra como REFERÊNCIA das seguintes. É por isso que elas precisam ser
// sequenciais, e não em paralelo como antes — a cena 2 depende da 1 existir.

export type Cena = { description: string; caption: string }

export type ReceitaStoryboard = {
  scenes: Cena[]
  platform: string
  songSource?: "suno" | "pedido" | "narracao"
  songOrderId?: string
  songTheme?: string
  songStyle?: string
  narracaoTexto?: string
  narracaoVoz?: string
  narracaoFundo?: "nenhum" | "pedido" | "suno"
  /** Quem fica na frente na mixagem: a voz (padrão) ou a música. */
  mixagem?: "voz" | "musica"
}

function aspecto(platform?: string): "9:16" | "16:9" {
  return platform === "youtube" ? "16:9" : "9:16"
}

function promptDeCena(descricao: string, comReferencia: boolean): string {
  return (
    `Fotografia realista, estilo editorial/lifestyle, câmera DSLR, luz natural. Pessoas ` +
    `brasileiras com pele e expressões naturais e genuínas, nada de aparência 3D ou pintura ` +
    `digital — parece uma foto tirada de verdade, não uma ilustração. ` +
    (comReferencia
      ? `MANTENHA AS MESMAS PESSOAS da imagem de referência: mesmos rostos, mesma idade, ` +
        `mesmo tipo físico, mesmas roupas e o mesmo ambiente da casa. Muda o momento, não o elenco. `
      : "") +
    `${descricao}. NÃO escreva nenhum texto, palavra ou legenda na imagem.`
  )
}

/**
 * Inicia a geração de uma cena na KIE e devolve o taskId, SEM esperar.
 *
 * Esperar dentro da requisição foi um erro caro: cada cena leva de 30 a 90s, e
 * um F5 no meio matava a conexão — a KIE já tinha sido acionada e cobrado, mas
 * o resultado não tinha mais onde ser gravado. Guardando o taskId, o trabalho
 * pago sobrevive a qualquer coisa que aconteça no navegador.
 */
async function iniciarCena(descricao: string, aspectRatio: "9:16" | "16:9", referencias?: string[]): Promise<string> {
  return generateImage({ prompt: promptDeCena(descricao, !!referencias), aspectRatio, imageUrls: referencias })
}

async function subir(supabase: DB, jobId: string, indice: number, bytes: Buffer): Promise<string> {
  // Caminho com timestamp: sobrescrever deixaria o navegador servindo a versão
  // antiga do cache e você juraria que refazer não funcionou.
  const path = `video-jobs/${jobId}/cena-${indice + 1}-${Date.now()}.png`
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "image/png", upsert: true })
  if (error) throw new Error(`Falha ao subir a cena ${indice + 1}: ${error.message}`)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * Etapa 1a: cria o job em `storyboard`, ainda SEM imagem nenhuma.
 */
export async function criarStoryboard(supabase: DB, draftId: string, receita: ReceitaStoryboard) {
  if (receita.scenes.length < 3 || receita.scenes.length > 6) {
    throw new Error("O storyboard precisa ter entre 3 e 6 cenas.")
  }

  const { data: job, error } = await supabase
    .from("video_jobs")
    .insert({
      contentDraftId: draftId,
      status: "storyboard",
      recipe: receita,
      scene_image_urls: [],
      scene_image_task_ids: [],
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await logContentEvent(supabase, draftId, "rascunho_criado", `storyboard: ${receita.scenes.length} cenas`)
  return job
}

/**
 * Motor do storyboard: uma passada que (1) recolhe as cenas que ficaram
 * prontas e (2) dispara a próxima. Devolve na hora, sem esperar nada.
 *
 * A tela chama isto em intervalos. Como todo estado mora no banco — taskId
 * pendente e URLs já salvas —, fechar a aba, dar F5 ou perder a rede não
 * cancela nem repete geração nenhuma: a próxima chamada continua de onde parou.
 */
export async function avancarStoryboard(supabase: DB, jobId: string) {
  const { data: job } = await supabase.from("video_jobs").select("*").eq("id", jobId).maybeSingle()
  if (!job) throw new Error("Storyboard não encontrado.")

  const receita = job.recipe as ReceitaStoryboard
  const total = receita.scenes.length
  const urls: (string | null)[] = [...(job.scene_image_urls ?? [])]
  const tasks: (string | null)[] = [...(job.scene_image_task_ids ?? [])]
  let mudou = false
  let erro: string | null = null

  // 1) Recolhe o que a KIE já terminou.
  for (let i = 0; i < total; i++) {
    const taskId = tasks[i]
    if (!taskId || urls[i]) continue

    const r = await getImageTaskResult(taskId)
    if (r.state === "success" && r.imageUrl) {
      const bytes = Buffer.from(await (await fetch(r.imageUrl)).arrayBuffer())
      urls[i] = await subir(supabase, jobId, i, bytes)
      tasks[i] = null
      mudou = true
      await logContentEvent(supabase, job.contentDraftId, "imagem_gerada", `cena ${i + 1} do storyboard`)
    } else if (r.state === "fail") {
      tasks[i] = null
      erro = r.failMsg ?? `A KIE não conseguiu gerar a cena ${i + 1}.`
      mudou = true
    }
  }

  // 2) Dispara a próxima que falta. Uma de cada vez: a cena 1 é a referência
  // de elenco das seguintes, então elas só podem começar depois que ela existe.
  const pendente = tasks.some((t, i) => t && !urls[i])
  if (!pendente) {
    const proxima = Array.from({ length: total }, (_, i) => i).find((i) => !urls[i] && !tasks[i])
    if (proxima !== undefined) {
      const podeReferenciar = proxima > 0 && !!urls[0]
      tasks[proxima] = await iniciarCena(
        receita.scenes[proxima].description,
        aspecto(receita.platform),
        podeReferenciar ? [urls[0] as string] : undefined,
      )
      mudou = true
    }
  }

  // 3) Áudio em PARALELO com as imagens. Narração é barata e a música é a
  // mais lenta (1 a 3 min) — esperar o storyboard terminar pra só então começar
  // dobrava o tempo total sem economizar nada no caso normal, em que a peça vai
  // ser usada de qualquer jeito.
  const patchAudio = await avancarAudio(supabase, job)
  if (Object.keys(patchAudio).length) mudou = true

  if (mudou) {
    await supabase
      .from("video_jobs")
      .update({ scene_image_urls: urls, scene_image_task_ids: tasks, error: erro, ...patchAudio })
      .eq("id", jobId)
  }

  const { data: atualizado } = await supabase.from("video_jobs").select("*").eq("id", jobId).single()
  const prontas = urls.filter(Boolean).length
  return {
    job: atualizado,
    prontas,
    total,
    gerando: tasks.some((t, i) => t && !urls[i]),
    concluido: prontas === total,
    erro,
  }
}

/**
 * Cuida do áudio dentro do mesmo motor: gera a narração se ainda não existe,
 * dispara a música se ainda não foi pedida, e recolhe a música quando fica
 * pronta. Idempotente — o que já existe nunca é regerado nem cobrado de novo.
 */
async function avancarAudio(supabase: DB, job: Record<string, any>): Promise<Record<string, unknown>> {
  const receita = job.recipe as ReceitaStoryboard
  const patch: Record<string, unknown> = {}

  try {
    // Narração: barata e rápida, feita na hora.
    if (receita.songSource === "narracao" && receita.narracaoTexto?.trim() && !job.narration_url) {
      const wav = await gerarNarracao(receita.narracaoTexto, (receita.narracaoVoz ?? "Kore") as VozId)
      const path = `video-jobs/${job.id}/narracao-${Date.now()}.wav`
      const { error } = await supabase.storage.from(BUCKET).upload(path, wav, { contentType: "audio/wav", upsert: true })
      if (error) throw new Error(error.message)
      patch.narration_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    }

    const querMusica =
      receita.songSource === "suno" ||
      receita.songSource === "pedido" ||
      (receita.songSource === "narracao" && receita.narracaoFundo && receita.narracaoFundo !== "nenhum")

    if (querMusica && !job.song_url) {
      const doPedido =
        receita.songSource === "pedido" || (receita.songSource === "narracao" && receita.narracaoFundo === "pedido")

      if (doPedido) {
        const { data: music } = await supabase
          .from("generated_music").select("mp3Url").eq("orderId", receita.songOrderId ?? "").maybeSingle()
        if (music?.mp3Url) patch.song_url = music.mp3Url
      } else if (!job.song_task_id) {
        // Ainda não pedida: dispara agora, em paralelo com as imagens.
        const { title, lyrics } = await generateSongLyrics(receita.songTheme ?? "", receita.songStyle ?? "")
        patch.song_task_id = await generateMusic({
          prompt: lyrics, style: receita.songStyle ?? "", title,
          vocalGender: "f", model: "V5",
          callBackUrl: "https://fizmusica.com.br/api/suno/callback-not-used-polling-instead",
        })
      } else {
        // Já pedida: vê se ficou pronta.
        const detalhes: any = await getMusicDetails(job.song_task_id)
        const track = detalhes?.data?.response?.sunoData?.[0]
        if (detalhes?.data?.status === "SUCCESS" && track?.audioUrl) {
          const bytes = Buffer.from(await (await fetch(track.audioUrl)).arrayBuffer())
          const path = `video-jobs/${job.id}/song-${Date.now()}.mp3`
          const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "audio/mpeg", upsert: true })
          if (error) throw new Error(error.message)
          patch.song_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
          patch.song_task_id = null
        }
      }
    }
  } catch (e) {
    console.error("[storyboard] áudio:", e instanceof Error ? e.message : e)
  }

  return patch
}

/**
 * Refaz UMA cena: limpa a imagem atual e dispara a geração nova. Quem recolhe
 * é o mesmo motor — então também sobrevive a F5.
 */
export async function refazerCenaStoryboard(
  supabase: DB,
  jobId: string,
  indice: number,
  descricao?: string,
  legenda?: string,
) {
  const { data: job } = await supabase.from("video_jobs").select("*").eq("id", jobId).maybeSingle()
  if (!job) throw new Error("Storyboard não encontrado.")

  const receita = job.recipe as ReceitaStoryboard
  const cenas = [...(receita.scenes ?? [])]
  if (indice < 0 || indice >= cenas.length) throw new Error("Cena inexistente.")

  const cena = { ...cenas[indice] }
  if (descricao?.trim()) cena.description = descricao.trim()
  if (legenda?.trim()) cena.caption = legenda.trim()
  cenas[indice] = cena

  const urls: (string | null)[] = [...(job.scene_image_urls ?? [])]
  const tasks: (string | null)[] = [...(job.scene_image_task_ids ?? [])]

  // A cena 1 é a âncora do elenco; refazendo ela, as outras seguem como estão
  // (quem decide refazê-las é você, uma a uma).
  const podeReferenciar = indice > 0 && !!urls[0]
  tasks[indice] = await iniciarCena(
    cena.description,
    aspecto(receita.platform),
    podeReferenciar ? [urls[0] as string] : undefined,
  )
  urls[indice] = null

  const { data } = await supabase
    .from("video_jobs")
    .update({ scene_image_urls: urls, scene_image_task_ids: tasks, recipe: { ...receita, scenes: cenas }, error: null })
    .eq("id", jobId)
    .select("*")
    .single()

  return data
}

/**
 * Etapa 2: prepara o áudio conforme a receita (narração e/ou trilha). Música do
 * Suno é assíncrona — devolve `aguardando` e quem finaliza é o polling.
 */
export async function prepararAudio(supabase: DB, jobId: string) {
  const { data: job } = await supabase.from("video_jobs").select("*").eq("id", jobId).maybeSingle()
  if (!job) throw new Error("Storyboard não encontrado.")
  const receita = job.recipe as ReceitaStoryboard

  const patch: Record<string, unknown> = {}

  // Narração
  if (receita.songSource === "narracao" && receita.narracaoTexto?.trim()) {
    const wav = await gerarNarracao(receita.narracaoTexto, (receita.narracaoVoz ?? "Kore") as VozId)
    const path = `video-jobs/${jobId}/narracao-${Date.now()}.wav`
    const { error } = await supabase.storage.from(BUCKET).upload(path, wav, { contentType: "audio/wav", upsert: true })
    if (error) throw new Error(`Falha ao subir a narração: ${error.message}`)
    patch.narration_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  // Trilha: do catálogo (instantânea) ou nova no Suno (minutos)
  const querMusica =
    receita.songSource === "suno" ||
    receita.songSource === "pedido" ||
    (receita.songSource === "narracao" && receita.narracaoFundo && receita.narracaoFundo !== "nenhum")

  if (querMusica) {
    const doPedido =
      receita.songSource === "pedido" || (receita.songSource === "narracao" && receita.narracaoFundo === "pedido")

    if (doPedido) {
      const orderId = receita.songOrderId
      if (!orderId) throw new Error("Escolha de qual pedido vem a música.")
      const { data: order } = await supabase
        .from("orders").select("publication_consent").eq("id", orderId).maybeSingle()
      if (!order?.publication_consent) throw new Error("Esse pedido não autoriza publicação.")
      const { data: music } = await supabase
        .from("generated_music").select("mp3Url").eq("orderId", orderId).maybeSingle()
      if (!music?.mp3Url) throw new Error("Esse pedido não tem música entregue.")
      patch.song_url = music.mp3Url
    } else {
      const { title, lyrics } = await generateSongLyrics(receita.songTheme ?? "", receita.songStyle ?? "")
      const taskId = await generateMusic({
        prompt: lyrics,
        style: receita.songStyle ?? "",
        title,
        vocalGender: "f",
        model: "V5",
        callBackUrl: "https://fizmusica.com.br/api/suno/callback-not-used-polling-instead",
      })
      patch.song_task_id = taskId
      patch.song_url = null
    }
  }

  const { data } = await supabase
    .from("video_jobs")
    .update({ ...patch, status: "storyboard", error: null })
    .eq("id", jobId)
    .select("*")
    .single()

  return { job: data, aguardando: patch.song_task_id ? "musica" : null }
}

/**
 * Atualiza a receita (textos de cena, narração, estilo da trilha) sem tocar no
 * que já foi gerado. Mudar o texto da narração invalida só a narração; mudar o
 * estilo da música invalida só a música — o resto continua de pé.
 */
export async function atualizarReceita(supabase: DB, jobId: string, patch: Partial<ReceitaStoryboard>) {
  const { data: job } = await supabase.from("video_jobs").select("*").eq("id", jobId).maybeSingle()
  if (!job) throw new Error("Storyboard não encontrado.")

  const receita = { ...(job.recipe as ReceitaStoryboard), ...patch }
  const update: Record<string, unknown> = { recipe: receita }

  const anterior = job.recipe as ReceitaStoryboard
  if (patch.narracaoTexto !== undefined && patch.narracaoTexto !== anterior.narracaoTexto) update.narration_url = null
  if (patch.narracaoVoz !== undefined && patch.narracaoVoz !== anterior.narracaoVoz) update.narration_url = null
  if (
    (patch.songStyle !== undefined && patch.songStyle !== anterior.songStyle) ||
    (patch.songTheme !== undefined && patch.songTheme !== anterior.songTheme)
  ) {
    update.song_url = null
    update.song_task_id = null
  }

  const { data } = await supabase.from("video_jobs").update(update).eq("id", jobId).select("*").single()
  return data
}

/** Etapa 3: libera pro worker montar o MP4. */
export async function compilar(supabase: DB, jobId: string) {
  const { data: job } = await supabase.from("video_jobs").select("*").eq("id", jobId).maybeSingle()
  if (!job) throw new Error("Storyboard não encontrado.")

  const receita = job.recipe as ReceitaStoryboard
  if ((job.scene_image_urls?.length ?? 0) !== (receita.scenes?.length ?? 0)) {
    throw new Error("Ainda faltam imagens de cena. Gere o storyboard completo antes de compilar.")
  }
  if (!job.song_url && !job.narration_url) {
    throw new Error("O vídeo precisa de áudio: prepare a narração ou a trilha antes de compilar.")
  }
  if (job.song_task_id && !job.song_url) {
    throw new Error("A música ainda está sendo gerada. Aguarde ela ficar pronta.")
  }

  const { data } = await supabase
    .from("video_jobs")
    .update({ status: "pronto_pra_renderizar", error: null, claimed_at: null })
    .eq("id", jobId)
    .select("*")
    .single()

  await logContentEvent(supabase, job.contentDraftId, "rascunho_criado", "storyboard aprovado, compilando MP4")
  return data
}
