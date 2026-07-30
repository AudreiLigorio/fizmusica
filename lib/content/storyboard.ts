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

/** Gera uma imagem e espera ficar pronta (a KIE leva de 30 a 90s por cena). */
async function gerarEEsperar(prompt: string, aspectRatio: "9:16" | "16:9", referencias?: string[]): Promise<Buffer> {
  const taskId = await generateImage({ prompt, aspectRatio, imageUrls: referencias })
  for (let i = 0; i < 40; i++) {
    const r = await getImageTaskResult(taskId)
    if (r.state === "success" && r.imageUrl) {
      return Buffer.from(await (await fetch(r.imageUrl)).arrayBuffer())
    }
    if (r.state === "fail") throw new Error(r.failMsg ?? "A KIE não conseguiu gerar a cena.")
    await new Promise((res) => setTimeout(res, 5000))
  }
  throw new Error("Tempo esgotado esperando a imagem da cena.")
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
    .insert({ contentDraftId: draftId, status: "storyboard", recipe: receita, scene_image_urls: [] })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await logContentEvent(supabase, draftId, "rascunho_criado", `storyboard: ${receita.scenes.length} cenas`)
  return job
}

/**
 * Etapa 1b: gera a PRÓXIMA cena que falta — uma por chamada.
 *
 * Uma cena por requisição, e não todas de uma vez, por dois motivos: seis cenas
 * a 30-90s cada estouram o tempo máximo de uma requisição, e assim você vê o
 * storyboard aparecendo em vez de esperar no escuro. A cena 1 entra como
 * referência das seguintes — daí serem sequenciais.
 */
export async function gerarProximaCena(supabase: DB, jobId: string) {
  const { data: job } = await supabase.from("video_jobs").select("*").eq("id", jobId).maybeSingle()
  if (!job) throw new Error("Storyboard não encontrado.")

  const receita = job.recipe as ReceitaStoryboard
  const urls: string[] = [...(job.scene_image_urls ?? [])]
  const indice = urls.length

  if (indice >= receita.scenes.length) {
    return { job, faltam: 0, concluido: true }
  }

  const referencias = urls.length ? [urls[0]] : undefined
  const bytes = await gerarEEsperar(
    promptDeCena(receita.scenes[indice].description, !!referencias),
    aspecto(receita.platform),
    referencias,
  )
  urls.push(await subir(supabase, jobId, indice, bytes))

  const { data } = await supabase
    .from("video_jobs")
    .update({ scene_image_urls: urls, error: null })
    .eq("id", jobId)
    .select("*")
    .single()

  const faltam = receita.scenes.length - urls.length
  await logContentEvent(supabase, job.contentDraftId, "imagem_gerada", `cena ${indice + 1} do storyboard`)
  return { job: data, faltam, concluido: faltam === 0 }
}

/** Refaz UMA cena do storyboard, mantendo a referência de personagem. */
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

  const urls: string[] = [...(job.scene_image_urls ?? [])]
  // A cena 1 é a âncora do elenco; refazendo ela, as outras perdem a referência
  // (mas não são regeradas — quem decide isso é você, cena por cena).
  const referencias = indice === 0 ? undefined : urls[0] ? [urls[0]] : undefined

  const bytes = await gerarEEsperar(promptDeCena(cena.description, !!referencias), aspecto(receita.platform), referencias)
  urls[indice] = await subir(supabase, jobId, indice, bytes)

  const { data } = await supabase
    .from("video_jobs")
    .update({ scene_image_urls: urls, recipe: { ...receita, scenes: cenas }, error: null })
    .eq("id", jobId)
    .select("*")
    .single()

  await logContentEvent(supabase, job.contentDraftId, "imagem_gerada", `cena ${indice + 1} refeita no storyboard`)
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
