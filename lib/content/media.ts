import type { createServerClient } from "@/lib/supabase"

type DB = ReturnType<typeof createServerClient>

const BUCKET = "content-media"

// Higiene de storage. O plano do Supabase tem teto (1 GB no gratuito) e cada
// vídeo pesa: N imagens de cena + o MP3 da música + o MP4 final. Guardar tudo
// pra sempre estoura o limite sem ninguém perceber — e mídia de peça rejeitada
// não serve pra absolutamente nada.
//
// Três limpezas, com propósitos diferentes:
//   purgeVideoIngredients — automática, assim que o MP4 fica pronto (as cenas e
//                           o áudio já estão DENTRO do vídeo);
//   purgeDraftMedia       — automática na rejeição, manual quando o admin pede;
//   ambas são idempotentes e nunca derrubam o fluxo que as chamou.

async function removerPasta(supabase: DB, prefixo: string): Promise<number> {
  const { data: itens } = await supabase.storage.from(BUCKET).list(prefixo)
  if (!itens?.length) return 0
  const caminhos = itens.filter((i) => i.id).map((i) => `${prefixo}/${i.name}`)
  if (!caminhos.length) return 0
  const { error } = await supabase.storage.from(BUCKET).remove(caminhos)
  if (error) throw new Error(error.message)
  return caminhos.length
}

// Apaga os ingredientes de um vídeo já renderizado, preservando o final.mp4.
export async function purgeVideoIngredients(supabase: DB, jobId: string): Promise<number> {
  const prefixo = `video-jobs/${jobId}`
  const { data: itens } = await supabase.storage.from(BUCKET).list(prefixo)
  const descartaveis = (itens ?? [])
    .filter((i) => i.id && i.name !== "final.mp4")
    .map((i) => `${prefixo}/${i.name}`)
  if (!descartaveis.length) return 0
  const { error } = await supabase.storage.from(BUCKET).remove(descartaveis)
  if (error) throw new Error(error.message)
  return descartaveis.length
}

export type PurgeResult = { arquivos: number; erro?: string }

// Apaga TODA a mídia de um rascunho: a imagem do post, os ingredientes e o
// vídeo final de cada job. Os textos (gancho, legenda, roteiro, parecer) e o
// registro de publicação continuam — são leves e servem de histórico.
export async function purgeDraftMedia(supabase: DB, draftId: string): Promise<PurgeResult> {
  try {
    let arquivos = 0

    // Imagem do post estático mora em `<draftId>/…`.
    arquivos += await removerPasta(supabase, draftId)

    // Cada job de vídeo tem a própria pasta.
    const { data: jobs } = await supabase
      .from("video_jobs")
      .select("id")
      .eq("contentDraftId", draftId)
    for (const job of jobs ?? []) {
      arquivos += await removerPasta(supabase, `video-jobs/${job.id}`)
    }

    await supabase
      .from("content_drafts")
      .update({ image_url: null, video_url: null, media_purged_at: new Date().toISOString() })
      .eq("id", draftId)

    if (jobs?.length) {
      await supabase
        .from("video_jobs")
        .update({ video_url: null })
        .eq("contentDraftId", draftId)
    }

    return { arquivos }
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Falha ao apagar a mídia."
    console.error("[content] purgeDraftMedia:", erro)
    return { arquivos: 0, erro }
  }
}

// Uso total do bucket, pra mostrar no painel. Percorre no máximo dois níveis —
// é a profundidade real da nossa estrutura (`<draftId>/` e `video-jobs/<id>/`).
export async function bucketUsageBytes(supabase: DB): Promise<number> {
  const soma = (itens: { id: string | null; metadata?: { size?: number } | null }[]) =>
    itens.reduce((acc, i) => acc + (i.id ? i.metadata?.size ?? 0 : 0), 0)

  const { data: raiz } = await supabase.storage.from(BUCKET).list("", { limit: 1000 })
  let total = soma(raiz ?? [])

  for (const pasta of (raiz ?? []).filter((i) => !i.id)) {
    const { data: nivel1 } = await supabase.storage.from(BUCKET).list(pasta.name, { limit: 1000 })
    total += soma(nivel1 ?? [])
    for (const sub of (nivel1 ?? []).filter((i) => !i.id)) {
      const { data: nivel2 } = await supabase.storage.from(BUCKET).list(`${pasta.name}/${sub.name}`, { limit: 1000 })
      total += soma(nivel2 ?? [])
    }
  }

  return total
}
