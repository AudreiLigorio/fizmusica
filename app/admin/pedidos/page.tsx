import { createServerClient } from "@/lib/supabase"
import OrdersList from "./OrdersList"

export const dynamic = "force-dynamic"

async function getOrders() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("orders")
    .select("id, nome, email, whatsapp, context, subcategory, musicalStyle, voiceType, emotion, status, paymentStatus, createdAt, products(name), product_delivery_options(label, days)")
    .order("createdAt", { ascending: false })
  return data ?? []
}

export default async function AdminPedidos() {
  const orders = await getOrders()

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Pedidos</h1>
      <p className="text-gray-500 text-sm mb-6">{orders.length} pedido{orders.length !== 1 ? "s" : ""} no total</p>

      <OrdersList orders={orders as any} />
    </div>
  )
}
