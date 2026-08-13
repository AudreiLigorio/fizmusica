import { createServerClient } from "@/lib/supabase"
import ProductionList from "./ProductionList"

export const dynamic = "force-dynamic"

async function getQueue() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("orders")
    .select("id, nome, email, whatsapp, subcategory, musicalStyle, voiceType, emotion, honoreeName, status, paymentStatus, createdAt, photo_effect, is_revision, parent_order_id, revision_note, lyricsApproved, lyricsDraft, sunoStatus, sunoTracks, sunoError, product_delivery_options(label, days), products(name, feat_qrcode), order_photos(id, url, is_cover, sort_order), payments(mpPaymentId, mpStatus)")
    .eq("paymentStatus", "PAID")
    .eq("lyricsApproved", true)
    .neq("status", "ABANDONED")
    .order("createdAt", { ascending: true })

  if (error) console.error("[producao] query error:", JSON.stringify(error))

  const orders = data ?? []

  try {
    if (orders.length > 0) {
      const ids = orders.map((o: any) => o.id)
      const { data: revisions } = await supabase
        .from("revision_requests")
        .select("orderId, message, status, createdAt")
        .in("orderId", ids)
        .eq("status", "PENDING")

      const revByOrder: Record<string, any> = {}
      for (const r of revisions ?? []) revByOrder[r.orderId] = r

      return { orders: orders.map((o: any) => ({ ...o, revision: revByOrder[o.id] ?? null })), error }
    }
  } catch (e) {
    console.error("[producao] revision query error:", e)
  }

  return { orders, error }
}

export default async function AdminProducao() {
  const { orders, error } = await getQueue()

  return (
    <div className="p-4 lg:p-8 max-w-5xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Fila de Produção</h1>
      <p className="text-gray-500 text-sm mb-6 lg:mb-8">Pedidos pagos aguardando produção da música</p>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
          ❌ Erro ao buscar pedidos: {error.message ?? JSON.stringify(error)}
        </div>
      )}

      <ProductionList orders={orders as any} />
    </div>
  )
}
