import { createServerClient } from "@/lib/supabase"

async function getStats() {
  const supabase = createServerClient()

  const [ordersRes, paidRes, pendingRes] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("paymentStatus", "PAID"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ])

  const revenueRes = await supabase
    .from("payments")
    .select("amount")
    .eq("status", "PAID")

  const revenue = (revenueRes.data ?? []).reduce((acc, p) => acc + Number(p.amount), 0)

  return {
    total:   ordersRes.count   ?? 0,
    paid:    paidRes.count     ?? 0,
    pending: pendingRes.count  ?? 0,
    revenue,
  }
}

async function getRecentOrders() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("orders")
    .select("id, nome, context, subcategory, status, paymentStatus, createdAt")
    .order("createdAt", { ascending: false })
    .limit(8)
  return data ?? []
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:       "Pendente",
  IN_PRODUCTION: "Em produção",
  DELIVERED:     "Entregue",
  ABANDONED:     "Abandonado",
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:       "bg-yellow-500/15 text-yellow-300",
  IN_PRODUCTION: "bg-blue-500/15 text-blue-300",
  DELIVERED:     "bg-green-500/15 text-green-300",
  ABANDONED:     "bg-gray-500/15 text-gray-400",
}

const PAYMENT_COLOR: Record<string, string> = {
  UNPAID:   "bg-red-500/15 text-red-300",
  PAID:     "bg-green-500/15 text-green-300",
  REFUNDED: "bg-gray-500/15 text-gray-400",
}

export default async function AdminDashboard() {
  const [stats, orders] = await Promise.all([getStats(), getRecentOrders()])

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-6 lg:mb-10">Visão geral do negócio</p>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-10">
        <StatCard label="Total de pedidos" value={stats.total} icon="🎵" />
        <StatCard label="Pagos"             value={stats.paid}  icon="✅" color="text-green-400" />
        <StatCard label="Aguardando"        value={stats.pending} icon="⏳" color="text-yellow-400" />
        <StatCard
          label="Receita total"
          value={`R$ ${stats.revenue.toFixed(2).replace(".", ",")}`}
          icon="💰"
          color="text-pink-400"
        />
      </div>

      {/* Pedidos recentes */}
      <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 lg:px-6 py-4 border-b border-white/10">
          <h2 className="font-semibold">Pedidos recentes</h2>
        </div>

        {/* Tabela — desktop */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500">
                <th className="text-left px-6 py-3">Cliente</th>
                <th className="text-left px-6 py-3">Ocasião</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Pagamento</th>
                <th className="text-left px-6 py-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-600">Nenhum pedido ainda.</td></tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-6 py-4 font-medium">{o.nome}</td>
                  <td className="px-6 py-4 text-gray-400">{o.subcategory}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${STATUS_COLOR[o.status] ?? ""}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${PAYMENT_COLOR[o.paymentStatus] ?? ""}`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{new Date(o.createdAt).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cards — mobile */}
        <div className="lg:hidden divide-y divide-white/5">
          {orders.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-600 text-sm">Nenhum pedido ainda.</p>
          )}
          {orders.map((o) => (
            <div key={o.id} className="px-4 py-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{o.nome}</p>
                <p className="text-gray-500 text-xs truncate mt-0.5">{o.subcategory}</p>
                <p className="text-gray-600 text-xs mt-1">{new Date(o.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLOR[o.status] ?? ""}`}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${PAYMENT_COLOR[o.paymentStatus] ?? ""}`}>
                  {o.paymentStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, icon, color = "text-white",
}: {
  label: string; value: string | number; icon: string; color?: string
}) {
  return (
    <div className="bg-black/40 border border-white/10 rounded-2xl p-5">
      <div className="text-2xl mb-3">{icon}</div>
      <div className={`text-2xl font-bold mb-1 ${color}`}>{value}</div>
      <div className="text-gray-500 text-sm">{label}</div>
    </div>
  )
}
