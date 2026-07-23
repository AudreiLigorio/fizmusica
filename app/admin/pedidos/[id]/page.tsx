import { createServerClient } from "@/lib/supabase"
import { notFound } from "next/navigation"
import Link from "next/link"
import { fmtDateTimeBR } from "@/lib/date"

export const dynamic = "force-dynamic"
import UpdateStatusButton from "./UpdateStatusButton"
import SyncPaymentButton from "./SyncPaymentButton"
import ReconcilePaymentButton from "./ReconcilePaymentButton"
import EditEmail from "./EditEmail"
import AdminPhotosManager from "./AdminPhotosManager"

const EVENT_LABELS: Record<string, { icon: string; label: string }> = {
  pedido_criado:              { icon: "🆕", label: "Pedido criado" },
  pagamento_confirmado:       { icon: "💳", label: "Pagamento confirmado" },
  letra_aprovada:             { icon: "✍️", label: "Letra aprovada" },
  letra_reprocessada:         { icon: "🔁", label: "Letra reprocessada pela IA" },
  foto_enviada:               { icon: "📸", label: "Foto enviada" },
  foto_removida:               { icon: "🗑️", label: "Foto removida" },
  capa_definida:               { icon: "⭐", label: "Capa definida" },
  versao_principal_alterada:   { icon: "🎵", label: "Versão principal alterada" },
  termo_entrega_aceito:        { icon: "🔒", label: "Termo de entrega aceito" },
  revisao_solicitada:          { icon: "✏️", label: "Revisão solicitada" },
  revisao_aceita:              { icon: "✅", label: "Revisão aceita" },
  musica_gerada:               { icon: "🤖", label: "Música gerada pela IA" },
  musica_liberada:             { icon: "🚀", label: "Música liberada ao cliente" },
  conteudo_gerado:             { icon: "🎬", label: "Rascunho de conteúdo gerado" },
}

async function getOrder(id: string) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("orders")
    .select(`*, order_answers(*), payments(*), product_delivery_options(label, days), order_photos(id, url, is_cover, sort_order), order_events(id, type, detail, actor, created_at)`)
    .eq("id", id)
    .single()
  return data
}

const STATUS_OPTIONS = ["PENDING", "IN_PRODUCTION", "DELIVERED", "ABANDONED"]

export default async function AdminPedidoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await getOrder(id)

  if (!order) notFound()

  const answers = [...(order.order_answers ?? [])].sort((a: { position: number }, b: { position: number }) => a.position - b.position)
  const payment = order.payments?.[0] ?? null
  const photos = [...(order.order_photos ?? [])].sort(
    (a: { is_cover: boolean; sort_order: number }, b: { is_cover: boolean; sort_order: number }) =>
      Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order
  )
  const events = [...(order.order_events ?? [])].sort(
    (a: { created_at: string }, b: { created_at: string }) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/pedidos" className="text-gray-500 hover:text-white text-sm">
          ← Pedidos
        </Link>
        <h1 className="text-2xl font-bold">Pedido</h1>
        <span className="text-gray-500 text-sm font-mono">{order.id}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Cliente */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Cliente</h2>
          <div className="space-y-2">
            <p className="font-semibold text-lg">{order.nome}</p>
            <p className="text-gray-400">{order.email}</p>
            <EditEmail orderId={order.id} current={order.email} />
            <p className="text-gray-400">{order.whatsapp}</p>
          </div>
        </div>

        {/* Preferências */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Preferências</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Ocasião</span>
              <span>{order.subcategory}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Estilo</span>
              <span>{order.musicalStyle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Voz</span>
              <span>{order.voiceType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Emoção</span>
              <span>{order.emotion}</span>
            </div>
            {order.product_delivery_options && (
              <div className="flex justify-between pt-2 mt-2 border-t border-white/10">
                <span className="text-yellow-400 font-medium">⏱ Prazo</span>
                <span className="text-yellow-300 font-semibold">
                  {order.product_delivery_options.label} ({order.product_delivery_options.days} dias úteis)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Status do pedido</h2>
          <UpdateStatusButton orderId={order.id} currentStatus={order.status} options={STATUS_OPTIONS} />
        </div>

        {/* Pagamento */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Pagamento</h2>
          {payment ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={payment.status === "PAID" ? "text-green-400" : "text-yellow-400"}>{payment.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Valor</span>
                <span>R$ {Number(payment.amount).toFixed(2).replace(".", ",")}</span>
              </div>
              {payment.mpStatus && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Status no MP</span>
                  <span className="text-gray-300">{payment.mpStatus}</span>
                </div>
              )}
              {payment.mpPaymentId && (
                <div className="pt-2 mt-1 border-t border-white/10">
                  <p className="text-gray-500 mb-1">ID do pagamento (Mercado Pago)</p>
                  <p className="font-mono text-xs text-pink-300 break-all select-all">{payment.mpPaymentId}</p>
                  <a
                    href={`https://www.mercadopago.com.br/activities/1/detail?id=${payment.mpPaymentId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300"
                  >
                    Abrir transação no Mercado Pago ↗
                  </a>
                </div>
              )}
              {payment.mpPreferenceId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">MP Preference</span>
                  <span className="font-mono text-xs text-gray-400 truncate max-w-[140px]">{payment.mpPreferenceId}</span>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-gray-600 text-sm">Sem pagamento registrado.</p>
              <p className="text-gray-600 text-xs mt-1">Cliente diz que pagou? Procure no Mercado Pago pelo nº do pedido.</p>
              <ReconcilePaymentButton orderId={order.id} />
            </>
          )}
          {payment && payment.status !== "PAID" && (
            <SyncPaymentButton orderId={order.id} />
          )}
        </div>
      </div>

      {/* Fotos do cliente — gerenciamento completo */}
      <AdminPhotosManager orderId={order.id} initial={photos} />

      {/* Respostas */}
      <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">Respostas do formulário</h2>
        {answers.length === 0 ? (
          <p className="text-gray-600 text-sm">Sem respostas.</p>
        ) : (
          <div className="space-y-5">
            {answers.map((a: { id: string; question: string; answer: string }, i: number) => (
              <div key={a.id}>
                <p className="text-xs text-pink-400 font-medium mb-1">{i + 1}. {a.question}</p>
                <p className="text-gray-200 leading-relaxed">{a.answer}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico do pedido — timeline de ações, com data/hora, pra apresentar em caso de contestação */}
      <div className="bg-black/40 border border-white/10 rounded-2xl p-6 mt-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">📜 Histórico do pedido</h2>
        {events.length === 0 ? (
          <p className="text-gray-600 text-sm">Sem eventos registrados ainda.</p>
        ) : (
          <div className="space-y-4">
            {events.map((e: { id: string; type: string; detail: string | null; actor: string; created_at: string }) => {
              const meta = EVENT_LABELS[e.type] ?? { icon: "•", label: e.type }
              return (
                <div key={e.id} className="flex gap-3">
                  <span className="text-lg shrink-0">{meta.icon}</span>
                  <div className="min-w-0 flex-1 border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{meta.label}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        e.actor === "admin" ? "bg-pink-500/15 text-pink-300" :
                        e.actor === "system" ? "bg-blue-500/15 text-blue-300" :
                        "bg-white/10 text-gray-400"
                      }`}>{e.actor}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtDateTimeBR(e.created_at)}</p>
                    {e.detail && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{e.detail}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
