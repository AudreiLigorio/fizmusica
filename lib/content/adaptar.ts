import type { createServerClient } from "@/lib/supabase"
import { createDraft } from "@/lib/content/generate"

type DB = ReturnType<typeof createServerClient>

const REDES = ["instagram", "tiktok", "youtube"] as const

// Adaptação de uma história para outra rede.
//
// Vive aqui porque dois caminhos chamam a mesma coisa: o botão "+ adaptar pro
// X" e a aprovação, que agora gera as versões que faltam automaticamente.

/** Clona os ingredientes de vídeo da peça de origem, se ainda existirem. */
async function herdarIngredientes(supabase: DB, origemId: string, novaId: string, platform: string) {
  const { data: job } = await supabase
    .from("video_jobs")
    .select("recipe, scene_image_urls, narration_url, song_url")
    .eq("contentDraftId", origemId)
    .not("scene_image_urls", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const urls = (job?.scene_image_urls ?? []) as string[]
  if (!urls.length || (!job?.song_url && !job?.narration_url)) return false

  // URL gravada não prova que o arquivo existe: os ingredientes podem ter sido
  // descartados. Herdar ponteiro quebrado produz um storyboard que diz
  // "completo" e não abre imagem nenhuma — já aconteceu.
  for (const url of [...urls, job.narration_url, job.song_url].filter(Boolean) as string[]) {
    const r = await fetch(url, { method: "HEAD" }).catch(() => null)
    if (!r?.ok) return false
  }

  await supabase.from("video_jobs").insert({
    contentDraftId: novaId,
    status: "storyboard", // entra no editor: confere e manda compilar (grátis)
    recipe: { ...(job.recipe as Record<string, unknown>), platform },
    scene_image_urls: urls,
    scene_image_task_ids: [],
    narration_url: job.narration_url,
    song_url: job.song_url,
  })
  return true
}

export type ResultadoAdaptacao = { platform: string; draftId: string; videoReaproveitado: boolean }

/** Cria a versão de UMA rede a partir de uma peça existente. */
export async function adaptarPara(supabase: DB, origemId: string, platform: string): Promise<ResultadoAdaptacao> {
  const { data: origem } = await supabase
    .from("content_drafts")
    .select("id, platform, source_type, sourceOrderId, topic, derivado_de")
    .eq("id", origemId)
    .maybeSingle()
  if (!origem) throw new Error("Peça de origem não encontrada.")
  if (origem.platform === platform) throw new Error("A peça já é dessa rede.")

  // A raiz é sempre a peça original — adaptação de adaptação não vira corrente.
  const raiz = origem.derivado_de ?? origem.id

  const nova =
    origem.source_type === "pedido"
      ? await createDraft(supabase, { platform, sourceType: "pedido", sourceOrderId: origem.sourceOrderId, derivadoDe: raiz })
      : await createDraft(supabase, { platform, sourceType: "generico", topic: origem.topic ?? "", derivadoDe: raiz })

  const videoReaproveitado = await herdarIngredientes(supabase, origem.id, nova.id, platform)
  return { platform, draftId: nova.id, videoReaproveitado }
}

/**
 * Cria as versões que faltam para as outras redes.
 *
 * Chamado na aprovação: história aprovada é história boa, e boa história serve
 * nas três. Pula rede que já tem versão — aprovar duas vezes não duplica peça.
 * Cada adaptação custa uma passada do roteirista e uma imagem de post; o vídeo,
 * quando existe, é herdado de graça.
 */
export async function adaptarParaAsQueFaltam(supabase: DB, draftId: string): Promise<ResultadoAdaptacao[]> {
  const { data: peca } = await supabase
    .from("content_drafts").select("id, platform, derivado_de").eq("id", draftId).maybeSingle()
  if (!peca) return []

  const raiz = peca.derivado_de ?? peca.id
  const { data: familia } = await supabase
    .from("content_drafts")
    .select("platform")
    .or(`id.eq.${raiz},derivado_de.eq.${raiz}`)

  const jaTem = new Set((familia ?? []).map((f) => f.platform))
  const feitas: ResultadoAdaptacao[] = []

  for (const rede of REDES) {
    if (jaTem.has(rede)) continue
    try {
      feitas.push(await adaptarPara(supabase, draftId, rede))
    } catch (e) {
      // Uma rede falhar não pode impedir as outras nem derrubar a aprovação.
      console.error(`[adaptar] ${rede}:`, e instanceof Error ? e.message : e)
    }
  }

  return feitas
}
