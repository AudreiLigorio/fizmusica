import { createServerClient } from "@/lib/supabase"
import { notFound } from "next/navigation"
import Link from "next/link"
import UpdateStatusButton from "./UpdateStatusButton"

async function getOrder(id: string) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("orders")
    .select(`*, order_answers(*), payments(*), product_delivery_options(label, days)`)
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
              {payment.mp_preference_id && (
                <div className="flex justify-between">
                  <span className="text-gray-500">MP Preference</span>
                  <span className="font-mono text-xs text-gray-400 truncate max-w-[140px]">{payment.mp_preference_id}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600 text-sm">Sem pagamento registrado.</p>
          )}
        </div>
      </div>

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
    </div>
  )
}
