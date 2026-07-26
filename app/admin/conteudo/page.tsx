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

  return { drafts: drafts ?? [], eligibleOrders: eligibleOrders ?? [] }
}

export default async function ConteudoPage() {
  const { drafts, eligibleOrders } = await getDrafts()
  const tiktokStatus = await getConnectionStatus()

  return (
    <div className="p-4 lg:p-8 max-w-5xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Conteúdo — Fase 1</h1>
      <p className="text-gray-500 text-sm mb-8">
        Rascunhos de post gerados por IA (legenda via Gemini + imagem via KIE.ai), aguardando aprovação.
        Nada aqui é publicado automaticamente em nenhuma rede.
      </p>
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
        <ConteudoList initialDrafts={drafts} eligibleOrders={eligibleOrders} tiktokStatus={tiktokStatus} />
      </div>
    </div>
  )
}
