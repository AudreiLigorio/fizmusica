import { createServerClient } from "@/lib/supabase"
import Link from "next/link"

async function getOrders() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("orders")
    .select("id, nome, email, whatsapp, context, subcategory, musicalStyle, voiceType, emotion, status, paymentStatus, createdAt")
    .order("createdAt", { ascending: false })
  return data ?? []
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:       "Pendente",
  IN_PRODUCTION: "Em produção",
  DELIVERED:     "Entregue",
  ABANDONED:     "Abandonado",
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:       "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
  IN_PRODUCTION: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  DELIVERED:     "bg-green-500/15 text-green-300 border-green-500/20",
  ABANDONED:     "bg-gray-500/15 text-gray-400 border-gray-500/20",
}

const PAYMENT_COLOR: Record<string, string> = {
  UNPAID:   "bg-red-500/15 text-red-300",
  PAID:     "bg-green-500/15 text-green-300",
  REFUNDED: "bg-gray-500/15 text-gray-400",
}

export default async function AdminPedidos() {
  const orders = await getOrders()

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Pedidos</h1>
      <p className="text-gray-500 mb-8">{orders.length} pedido{orders.length !== 1 ? "s" : ""} no total</p>

      <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-500">
                <th className="text-left px-6 py-4">Cliente</th>
                <th className="text-left px-6 py-4">Contato</th>
                <th className="text-left px-6 py-4">Ocasião</th>
                <th className="text-left px-6 py-4">Estilo</th>
                <th className="text-left px-6 py-4">Status</th>
                <th className="text-left px-6 py-4">Pagamento</th>
                <th className="text-left px-6 py-4">Data</th>
                <th className="text-left px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-600">
                    Nenhum pedido ainda.
                  </td>
                </tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium">{o.nome}</div>
                    <div className="text-gray-500 text-xs truncate max-w-[160px]">{o.id}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    <div>{o.email}</div>
                    <div className="text-xs">{o.whatsapp}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{o.subcategory}</td>
                  <td className="px-6 py-4 text-gray-400 text-xs">{o.musicalStyle}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${STATUS_COLOR[o.status] ?? ""}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${PAYMENT_COLOR[o.paymentStatus] ?? ""}`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/pedidos/${o.id}`}
                      className="text-pink-400 hover:text-pink-300 text-xs font-medium"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
