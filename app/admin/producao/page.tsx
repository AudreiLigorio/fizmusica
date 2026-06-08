import { createServerClient } from "@/lib/supabase"
import Link from "next/link"
import MusicaForm from "./MusicaForm"

export const dynamic = "force-dynamic"

const STATUS_COLOR: Record<string, string> = {
  PENDING:       "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  IN_PRODUCTION: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  DELIVERED:     "bg-green-500/10 text-green-400 border-green-500/20",
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:       "Aguardando",
  IN_PRODUCTION: "Em produção",
  DELIVERED:     "Entregue",
}

async function getQueue() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, nome, email, whatsapp, context, subcategory,
      musicalStyle, voiceType, emotion, honoreeName,
      status, paymentStatus, createdAt,
      product_delivery_options ( label, days )
    `)
    .eq("paymentStatus", "PAID")
    .neq("status", "ABANDONED")
    .order("createdAt", { ascending: true })

  if (error) console.error("[producao] query error:", JSON.stringify(error))
  console.log("[producao] rows returned:", data?.length ?? 0)

  return data ?? []
}

export default async function AdminProducao() {
  const orders = await getQueue()

  const waiting    = orders.filter((o) => o.status === "PENDING")
  const inProd     = orders.filter((o) => o.status === "IN_PRODUCTION")
  const delivered  = orders.filter((o) => o.status === "DELIVERED")

  return (
    <div className="p-4 lg:p-8 max-w-5xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Fila de Produção</h1>
      <p className="text-gray-500 text-sm mb-6 lg:mb-8">Pedidos pagos aguardando produção da música</p>

      {/* RESUMO */}
      <div className="grid grid-cols-3 gap-3 lg:gap-4 mb-6 lg:mb-10">
        {[
          { label: "Aguardando",  count: waiting.length,   color: "text-yellow-400" },
          { label: "Em produção", count: inProd.length,    color: "text-blue-400"   },
          { label: "Entregues",   count: delivered.length, color: "text-green-400"  },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-black/40 border border-white/10 rounded-2xl p-5 text-center">
            <p className={`text-3xl font-bold ${color}`}>{count}</p>
            <p className="text-gray-500 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-4">🎵</p>
          <p>Nenhum pedido pago na fila ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            return (
              <div
                key={order.id}
                className="bg-black/40 border border-white/10 rounded-2xl p-6"
              >
                {/* Cabeçalho */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-semibold">{order.nome}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[order.status] ?? ""}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{order.email} · {order.whatsapp}</p>
                    {order.honoreeName && (
                      <p className="text-xs text-pink-400 mt-0.5">🎁 Para: {order.honoreeName}</p>
                    )}
                  </div>
                  <div className="text-right text-xs shrink-0">
                    {(order as any).product_delivery_options && (
                      <p className="text-yellow-400 font-semibold mt-0.5">
                        ⏱ {(order as any).product_delivery_options.label} · {(order as any).product_delivery_options.days}d úteis
                      </p>
                    )}
                    <p className="text-gray-600 mt-0.5">{new Date(order.createdAt).toLocaleDateString("pt-BR")}</p>
                    <Link href={`/admin/pedidos/${order.id}`} className="text-blue-400 hover:underline mt-1 block">Ver pedido →</Link>
                  </div>
                </div>

                {/* Briefing */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    { label: "Ocasião",    value: order.subcategory },
                    { label: "Estilo",     value: order.musicalStyle },
                    { label: "Voz",        value: order.voiceType },
                    { label: "Emoção",     value: order.emotion },
                  ].map(({ label, value }) => value && (
                    <span key={label} className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-gray-300">
                      <span className="text-gray-500">{label}:</span> {value}
                    </span>
                  ))}
                </div>

                {/* Form de produção */}
                <MusicaForm
                  orderId={order.id}
                  honoreeName={order.honoreeName ?? null}
                  nome={order.nome}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
