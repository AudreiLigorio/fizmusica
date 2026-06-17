import { createServerClient } from "@/lib/supabase"
import ProductionList from "./ProductionList"

export const dynamic = "force-dynamic"

async function getQueue() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("orders")
    .select("id, nome, email, whatsapp, subcategory, musicalStyle, voiceType, emotion, honoreeName, status, paymentStatus, createdAt, photo_effect, products(name), product_delivery_options(label, days), order_photos(id, url, is_cover, sort_order), payments(mpPaymentId, mpStatus)")
    .eq("paymentStatus", "PAID")
    .neq("status", "ABANDONED")
    .order("createdAt", { ascending: true })

  if (error) console.error("[producao] query error:", JSON.stringify(error))

  return { orders: data ?? [], error }
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
