import { createServerClient } from "@/lib/supabase"
import { getConnectionStatus } from "@/lib/content/publishers/tiktok-auth"
import { bucketUsageBytes } from "@/lib/content/media"
import { getContentSettings } from "@/lib/content/cmo"
import ConteudoList from "./ConteudoList"

export const dynamic = "force-dynamic"

const POR_PAGINA = 10

async function getDrafts(pagina: number) {
  const supabase = createServerClient()

  // Paginado: a lista cresce todo dia com a esteira rodando, e rolar 200 cards
  // pra achar o de hoje não é navegação, é castigo.
  const de = (pagina - 1) * POR_PAGINA
  const { data: drafts, count: totalDrafts } = await supabase
    .from("content_drafts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(de, de + POR_PAGINA - 1)

  // Pedidos elegíveis como fonte: só os com consentimento de publicação
  // (mesma regra do Catálogo, /admin/musicas).
  const { data: eligibleOrders } = await supabase
    .from("orders")
    .select("id, nome, subcategory")
    .eq("publication_consent", true)
    .order("createdAt", { ascending: false })
    .limit(200)

  // Dados do pedido de origem das peças que usam história/foto de cliente
  // real. O consentimento é lido AGORA, não no momento em que a peça nasceu:
  // ele pode ter sido revogado no meio do caminho, e publicar depois disso
  // seria usar dado de uma pessoa sem autorização.
  const origemIds = (drafts ?? []).map((d) => d.sourceOrderId).filter(Boolean) as string[]
  const origens: Record<string, { nome: string; honoreeName: string | null; consent: boolean; fotos: number }> = {}
  if (origemIds.length) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, nome, honoreeName, publication_consent")
      .in("id", origemIds)
    const { data: fotos } = await supabase
      .from("order_photos")
      .select("orderId")
      .in("orderId", origemIds)
    for (const o of orders ?? []) {
      origens[o.id] = {
        nome: o.nome ?? "—",
        honoreeName: o.honoreeName ?? null,
        consent: !!o.publication_consent,
        fotos: (fotos ?? []).filter((f) => f.orderId === o.id).length,
      }
    }
  }

  // Job de vídeo de cada rascunho. Precisa vir JÁ na lista, e não só dentro do
  // formulário: sem isso, um F5 fechava o formulário e o card ficava mudo,
  // como se o vídeo em produção não existisse.
  const { data: videoJobs } = await supabase
    .from("video_jobs")
    .select("id, contentDraftId, status, error, video_url, created_at")
    .order("created_at", { ascending: false })

  const jobPorDraft: Record<string, { id: string; status: string; error: string | null; video_url: string | null }> = {}
  for (const j of videoJobs ?? []) {
    if (!jobPorDraft[j.contentDraftId]) {
      jobPorDraft[j.contentDraftId] = { id: j.id, status: j.status, error: j.error, video_url: j.video_url }
    }
  }

  // Catálogo de trilhas: músicas já entregues cujo pedido autoriza publicação.
  // Serve pra usar uma canção real como trilha de qualquer peça, não só da que
  // nasceu daquele pedido.
  const { data: consentidos } = await supabase
    .from("orders")
    .select("id, honoreeName, subcategory")
    .eq("publication_consent", true)
  const { data: musicas } = await supabase
    .from("generated_music")
    .select("orderId, musicName")
    .not("mp3Url", "is", null)

  const trilhas = (musicas ?? [])
    .filter((m) => (consentidos ?? []).some((o) => o.id === m.orderId))
    .map((m) => {
      const o = (consentidos ?? []).find((x) => x.id === m.orderId)!
      return { orderId: m.orderId, label: `${m.musicName ?? "sem título"} — ${o.subcategory ?? "pedido"}` }
    })

  // Cliques por rascunho. O volume é baixo (um clique = uma visita vinda de
  // post), então contar em memória sai mais simples que view agregada no banco.
  const { data: links } = await supabase.from("content_links").select("id, draft_id")
  const { data: clicks } = await supabase.from("content_link_clicks").select("link_id")

  const clicksByDraft: Record<string, number> = {}
  for (const link of links ?? []) {
    if (!link.draft_id) continue
    clicksByDraft[link.draft_id] = (clicks ?? []).filter((c) => c.link_id === link.id).length
  }

  // Uso do storage: o plano tem teto e mídia acumula rápido (cada vídeo pesa).
  // Melhor ver o número crescendo do que descobrir quando parar de subir.
  let storageBytes = 0
  try {
    storageBytes = await bucketUsageBytes(supabase)
  } catch {
    // Contagem é informativa: falhar aqui não pode derrubar a tela.
  }

  return { drafts: drafts ?? [], eligibleOrders: eligibleOrders ?? [], clicksByDraft, storageBytes, origens, jobPorDraft, trilhas, totalDrafts: totalDrafts ?? 0, porPagina: POR_PAGINA }
}

export default async function ConteudoPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams
  const pagina = Math.max(1, Number(page) || 1)
  const { drafts, eligibleOrders, clicksByDraft, storageBytes, origens, jobPorDraft, trilhas, totalDrafts, porPagina } =
    await getDrafts(pagina)
  const storageMb = storageBytes / 1024 / 1024
  const storagePct = (storageMb / 1024) * 100
  const tiktokStatus = await getConnectionStatus()
  const settings = await getContentSettings(createServerClient())

  return (
    <div className="p-4 lg:p-8 max-w-5xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Conteúdo</h1>
      <p className="text-gray-500 text-sm mb-8">
        Rascunhos roteirizados por IA (roteiro + revisão crítica via Gemini, imagem via KIE.ai),
        aguardando sua aprovação. Nada é publicado automaticamente em nenhuma rede.
      </p>
      <p className="text-xs mb-6">
        <span className={storagePct > 80 ? "text-red-400" : storagePct > 50 ? "text-amber-400" : "text-gray-500"}>
          🗄️ Mídia armazenada: {storageMb.toFixed(1)} MB ({storagePct.toFixed(1)}% de 1 GB)
        </span>
        <span className="text-gray-600"> — rejeitado apaga sozinho; aprovado tem o botão “apagar mídia” no card.</span>
      </p>

      <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
        <ConteudoList
          initialDrafts={drafts}
          eligibleOrders={eligibleOrders}
          tiktokStatus={tiktokStatus}
          clicksByDraft={clicksByDraft}
          settings={settings}
          origens={origens}
          jobPorDraft={jobPorDraft}
          trilhas={trilhas}
          pagina={pagina}
          totalPaginas={Math.max(1, Math.ceil(totalDrafts / porPagina))}
        />
      </div>
    </div>
  )
}
