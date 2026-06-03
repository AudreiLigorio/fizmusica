"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import Header from "../components/Header"
import Footer from "../components/Footer"

type OrderData = {
  id: string
  nome: string
  paymentStatus: string
  status: string
  products?: { name: string; price: number } | null
  payments?: { amount: number; status: string; mpStatus: string | null } | null
}

function SucessoContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const orderId  = searchParams.get("orderId")
  const statusQS = searchParams.get("status") // "pending" vindo do MP back_url

  const [order, setOrder] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) { setLoading(false); return }

    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((d) => { setOrder(d.order ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [orderId])

  const isPaid    = order?.paymentStatus === "PAID"
  const isPending = !isPaid && (statusQS === "pending" || order?.payments?.mpStatus === "pending")

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <Header showButton={false} />

      <div className="flex items-center justify-center px-6 pt-24 pb-16 min-h-screen">
        <div className="max-w-2xl w-full">

          {/* ÍCONE ANIMADO */}
          <div className="text-center mb-10">
            <div className="relative inline-flex">
              <div className="w-28 h-28 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-6xl shadow-[0_0_60px_rgba(236,72,153,0.3)]">
                🎵
              </div>
              <div className="absolute inset-0 rounded-full bg-pink-500/10 animate-ping" />
            </div>
          </div>

          {/* CARD PRINCIPAL */}
          <div className="bg-white/5 border border-white/10 rounded-[40px] p-10 backdrop-blur-xl shadow-2xl mb-6">

            <div className="text-center mb-8">
              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6 ${
                    isPaid
                      ? "bg-green-500/10 border border-green-500/20 text-green-400"
                      : isPending
                      ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
                      : "bg-green-500/10 border border-green-500/20 text-green-400"
                  }`}>
                    {isPaid ? "✅ Pagamento confirmado" : isPending ? "⏳ Pagamento em análise" : "✅ Pedido recebido"}
                  </div>

                  <h1 className="text-4xl font-bold mb-4 leading-tight">
                    {order?.nome ? `Obrigado, ${order.nome.split(" ")[0]}!` : "Recebemos sua história!"}{" "}
                    <span className="bg-gradient-to-r from-pink-400 to-fuchsia-500 bg-clip-text text-transparent">❤️</span>
                  </h1>

                  <p className="text-lg text-gray-300 leading-relaxed">
                    {isPaid
                      ? "Pagamento confirmado! Nossa equipe já iniciará a produção da sua música."
                      : isPending
                      ? "Seu pagamento está sendo processado. Assim que confirmado, começamos imediatamente."
                      : "Seu pedido foi recebido e nossa equipe já iniciará a preparação da sua música personalizada."}
                  </p>
                </>
              )}
            </div>

            {/* PRODUTO + VALOR */}
            {order?.products && (
              <div className="bg-pink-500/10 border border-pink-500/20 rounded-2xl p-5 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-pink-400 font-medium mb-1 uppercase tracking-wider">
                    Produto selecionado
                  </p>
                  <p className="text-lg font-bold">{order.products.name}</p>
                </div>
                {order.payments?.amount && (
                  <p className="text-2xl font-bold text-pink-400">
                    R$ {Number(order.payments.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            )}

            {/* PRÓXIMOS PASSOS */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
              <h2 className="text-lg font-bold mb-5">Próximos passos ❤️</h2>
              <div className="space-y-4">
                {(isPaid
                  ? [
                      ["✅", "Pagamento confirmado — obrigado!"],
                      ["🎵", "Nossa equipe inicia a produção da sua música"],
                      ["📞", "Entraremos em contato pelo WhatsApp em breve"],
                      ["🎶", "Sua música personalizada chegará via WhatsApp"],
                    ]
                  : [
                      ["1️⃣", "Nossa equipe receberá seus dados e analisará sua história"],
                      ["2️⃣", "Entraremos em contato pelo WhatsApp em breve"],
                      ["3️⃣", isPending ? "Aguardando confirmação do pagamento" : "Você receberá o link de pagamento seguro"],
                      ["4️⃣", "Após confirmação, iniciamos a produção da música"],
                      ["5️⃣", "Sua música personalizada chegará via WhatsApp 🎶"],
                    ]
                ).map(([emoji, text]) => (
                  <div key={emoji} className="flex gap-4 items-start">
                    <span className="text-xl shrink-0">{emoji}</span>
                    <p className="text-gray-300 leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* NÚMERO DO PEDIDO */}
            {orderId && (
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-center text-sm text-gray-500 mb-6 font-mono">
                Pedido # {orderId}
              </div>
            )}

            {/* WHATSAPP */}
            <a
              href="https://wa.me/5511986858927"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full bg-green-500 hover:bg-green-600 transition-all py-5 rounded-2xl text-xl font-bold shadow-2xl shadow-green-500/20"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Falar no WhatsApp
            </a>
          </div>

          {/* ACOMPANHAR PEDIDO */}
          {orderId && (
            <div className="text-center mb-4">
              <button
                onClick={() => router.push(`/minha-musica?orderId=${orderId}`)}
                className="text-pink-400 hover:text-pink-300 transition-colors text-sm font-medium"
              >
                🎵 Acompanhar meu pedido
              </button>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={() => router.push("/")}
              className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
            >
              ← Voltar para a página inicial
            </button>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  )
}

export default function Sucesso() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SucessoContent />
    </Suspense>
  )
}
