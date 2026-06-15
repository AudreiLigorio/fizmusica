import { createServerClient } from "@/lib/supabase"
import { notFound } from "next/navigation"
import Link from "next/link"

export const dynamic = "force-dynamic"
import UpdateStatusButton from "./UpdateStatusButton"
import SyncPaymentButton from "./SyncPaymentButton"

async function getOrder(id: string) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("orders")
    .select(`*, order_answers(*), payments(*), product_delivery_options(label, days), order_photos(id, url, is_cover, sort_order)`)
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
          {payment && payment.status !== "PAID" && (
            <SyncPaymentButton orderId={order.id} />
          )}
        </div>
      </div>

      {/* Fotos enviadas pelo cliente */}
      {photos.length > 0 && (
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">
            Fotos do cliente <span className="text-gray-600 normal-case">({photos.length})</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((p: { id: string; url: string; is_cover: boolean }) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`relative block rounded-xl overflow-hidden border-2 transition-all hover:opacity-90 ${
                  p.is_cover ? "border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.25)]" : "border-white/10"
                }`}
                style={{ aspectRatio: "1/1" }}
              >
                <img src={p.url} alt="Foto do cliente" className="w-full h-full object-cover" />
                {p.is_cover && (
                  <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-pink-500 text-white px-2 py-0.5 rounded-full">
                    ★ CAPA
                  </span>
                )}
              </a>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-4">Clique em uma foto para abrir em tamanho real.</p>
        </div>
      )}

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
