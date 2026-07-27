import { createServerClient } from "@/lib/supabase"
import { getConnectionStatus } from "@/lib/content/publishers/tiktok-auth"
import ConteudoList from "./ConteudoList"

export const dynamic = "force-dynamic"

async function getDrafts() {
  const supabase = createServerClient()

  const { data: drafts } = await supabase
    .from("content_drafts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200)

  // Pedidos elegíveis como fonte: só os com consentimento de publicação
  // (mesma regra do Catálogo, /admin/musicas).
  const { data: eligibleOrders } = await supabase
    .from("orders")
    .select("id, nome, subcategory")
    .eq("publication_consent", true)
    .order("createdAt", { ascending: false })
    .limit(200)

  // Cliques por rascunho. O volume é baixo (um clique = uma visita vinda de
  // post), então contar em memória sai mais simples que view agregada no banco.
  const { data: links } = await supabase.from("content_links").select("id, draft_id")
  const { data: clicks } = await supabase.from("content_link_clicks").select("link_id")

  const clicksByDraft: Record<string, number> = {}
  for (const link of links ?? []) {
    if (!link.draft_id) continue
    clicksByDraft[link.draft_id] = (clicks ?? []).filter((c) => c.link_id === link.id).length
  }

  return { drafts: drafts ?? [], eligibleOrders: eligibleOrders ?? [], clicksByDraft }
}

export default async function ConteudoPage() {
  const { drafts, eligibleOrders, clicksByDraft } = await getDrafts()
  const tiktokStatus = await getConnectionStatus()

  return (
    <div className="p-4 lg:p-8 max-w-5xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Conteúdo</h1>
      <p className="text-gray-500 text-sm mb-8">
        Rascunhos roteirizados por IA (roteiro + revisão crítica via Gemini, imagem via KIE.ai),
        aguardando sua aprovação. Nada é publicado automaticamente em nenhuma rede.
      </p>
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
        <ConteudoList
          initialDrafts={drafts}
          eligibleOrders={eligibleOrders}
          tiktokStatus={tiktokStatus}
          clicksByDraft={clicksByDraft}
        />
      </div>
    </div>
  )
}
