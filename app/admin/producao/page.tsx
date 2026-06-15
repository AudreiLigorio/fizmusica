import { createServerClient } from "@/lib/supabase"
import Link from "next/link"
import MusicaForm from "./MusicaForm"
import PhotoEffectSelect from "./PhotoEffectSelect"

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
    .select("id, nome, email, whatsapp, subcategory, musicalStyle, voiceType, emotion, honoreeName, status, paymentStatus, createdAt, photo_effect, products(name), order_photos(id, url, is_cover, sort_order)")
    .eq("paymentStatus", "PAID")
    .neq("status", "ABANDONED")
    .order("createdAt", { ascending: true })

  if (error) console.error("[producao] query error:", JSON.stringify(error))
  console.log("[producao] rows returned:", data?.length ?? 0)

  return { orders: data ?? [], error }
}

export default async function AdminProducao() {
  const { orders, error } = await getQueue()

  const waiting    = orders.filter((o) => o.status === "PENDING")
  const inProd     = orders.filter((o) => o.status === "IN_PRODUCTION")
  const delivered  = orders.filter((o) => o.status === "DELIVERED")

  return (
    <div className="p-4 lg:p-8 max-w-5xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Fila de Produção</h1>
      <p className="text-gray-500 text-sm mb-6 lg:mb-8">Pedidos pagos aguardando produção da música</p>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
          ❌ Erro ao buscar pedidos: {error.message ?? JSON.stringify(error)}
        </div>
      )}

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
                    <p className="text-gray-400 font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-gray-500 mt-0.5">{new Date(order.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
                    <p className="text-gray-600">{new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</p>
                    <Link href={`/admin/pedidos/${order.id}`} className="text-blue-400 hover:underline mt-1 block">Ver pedido →</Link>
                  </div>
                </div>

                {/* Briefing */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    { label: "Produto",    value: (order as any).products?.name },
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

                {/* Fotos enviadas pelo cliente */}
                {Array.isArray((order as any).order_photos) && (order as any).order_photos.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">📸 Fotos do cliente ({(order as any).order_photos.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {[...(order as any).order_photos]
                        .sort((a: any, b: any) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)
                        .map((p: { id: string; url: string; is_cover: boolean }) => (
                          <a
                            key={p.id}
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`relative block w-20 h-20 rounded-xl overflow-hidden border-2 transition-all hover:opacity-90 ${
                              p.is_cover ? "border-pink-500 shadow-[0_0_16px_rgba(236,72,153,0.25)]" : "border-white/10"
                            }`}
                          >
                            <img src={p.url} alt="Foto do cliente" className="w-full h-full object-cover" />
                            {p.is_cover && (
                              <span className="absolute top-1 left-1 text-[9px] font-bold bg-pink-500 text-white px-1.5 py-0.5 rounded-full">★</span>
                            )}
                          </a>
                        ))}
                    </div>
                    <PhotoEffectSelect orderId={order.id} current={(order as any).photo_effect ?? "slide"} />
                  </div>
                )}

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
