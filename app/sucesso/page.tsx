"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { track } from "@/lib/track"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import Header from "../components/Header"
import Footer from "../components/Footer"
import JourneyProgress from "../components/JourneyProgress"

type OrderData = {
  id: string
  nome: string
  email?: string | null
  paymentStatus: string
  status: string
  photo_token?: string | null
  products?: { name: string; price: number } | null
  payments?: { amount: number; status: string; mpStatus: string | null } | null
}

function SucessoContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const orderId     = searchParams.get("orderId")
  const statusQS    = searchParams.get("status")
  const mpPaymentId = searchParams.get("mpPaymentId")

  const [order, setOrder] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) { setLoading(false); return }

    const confirm = async () => {
      // 1. Confirma pagamento se aprovado
      if (statusQS === "approved" && mpPaymentId) {
        await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, mpPaymentId }),
        })
      }

      // 2. Busca pedido já atualizado
      const d = await fetch(`/api/orders/${orderId}`).then((r) => r.json())
      setOrder(d.order ?? null)
      setLoading(false)

      // 3. Limpa sessão do wizard — pagamento confirmado, pedido encerrado
      if (d.order?.paymentStatus === "PAID") {
        track("pago")
        localStorage.removeItem("fizmusica_session_id")
      }
    }

    confirm().catch(() => setLoading(false))
  }, [orderId])

  const isPaid    = order?.paymentStatus === "PAID"
  const isPending = !isPaid && (statusQS === "pending" || order?.payments?.mpStatus === "pending")

  return (
    <div className="relative min-h-screen text-white font-sans overflow-hidden" style={{ background: "#07060d" }}>
      {/* Fundo gradiente da marca */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0" style={{ background: "radial-gradient(60% 50% at 15% 8%, rgba(240,25,107,0.30) 0%, transparent 60%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(60% 55% at 88% 95%, rgba(168,85,247,0.28) 0%, transparent 62%)" }} />
      </div>

      <div className="relative z-10">
        <Header showButton={false} />
        <div className="border-b border-white/[0.06] px-4 pt-16">
          <JourneyProgress current={4} />
        </div>

        <div className="flex items-center justify-center px-5 pt-10 pb-16 min-h-screen">
          <div className="max-w-xl w-full">

            {loading ? (
              <div className="flex justify-center py-24">
                <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* TÍTULO */}
                <div className="text-center mb-8">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-5 ${
                    isPaid
                      ? "bg-green-500/10 border border-green-500/20 text-green-400"
                      : isPending
                      ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
                      : "bg-green-500/10 border border-green-500/20 text-green-400"
                  }`}>
                    {isPaid ? "✅ Pagamento confirmado" : isPending ? "⏳ Pagamento em análise" : "✅ Pedido recebido"}
                  </div>

                  <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
                    {order?.nome ? "Obrigado, " : "Recebemos sua história!"}
                    {order?.nome && (
                      <span className="bg-gradient-to-r from-pink-400 to-fuchsia-500 bg-clip-text text-transparent">
                        {order.nome.split(" ")[0]}!
                      </span>
                    )}
                  </h1>
                  <p className="text-gray-300 leading-relaxed mt-3">
                    {isPaid
                      ? "Sua música está garantida. Agora é hora de personalizar."
                      : isPending
                      ? "Seu pagamento está sendo processado. Assim que confirmar, começamos."
                      : "Seu pedido foi recebido e já vamos preparar sua música personalizada."}
                  </p>
                </div>

                {/* ⭐ DESTAQUE: ENTRAR NA ÁREA (acompanhar + fotos) */}
                {isPaid && (
                  <>
                    <button
                      onClick={() => router.push(order?.photo_token ? `/preparar/${order.photo_token}` : `/minha-musica?orderId=${orderId ?? ""}`)}
                      className="group block w-full text-left rounded-3xl p-7 mb-3 relative overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.99]"
                      style={{
                        background: "linear-gradient(135deg, #f0196b 0%, #d946ef 55%, #a855f7 100%)",
                        boxShadow: "0 16px 50px rgba(217,70,239,0.35)",
                      }}
                    >
                      <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
                      <div className="relative">
                        <span className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl shrink-0 mb-3">✨</span>
                        <h2 className="text-2xl font-bold leading-tight mb-1">Personalize sua música</h2>
                        <p className="text-white/85 text-sm leading-relaxed mb-5">
                          Entre na sua área para aprovar a letra, cadastrar fotos e acessar o player.
                        </p>
                        <span className="inline-flex items-center gap-2 bg-white text-pink-600 font-bold text-sm px-6 py-3 rounded-2xl shadow-lg group-hover:gap-3 transition-all">
                          Entrar na minha área
                          <span className="transition-transform group-hover:translate-x-0.5">→</span>
                        </span>
                        <p className="text-white/70 text-xs leading-relaxed mt-3">
                          As funcionalidades disponíveis variam de acordo com o plano contratado.
                        </p>
                      </div>
                    </button>

                    <p className="text-yellow-200 text-sm leading-relaxed mb-3 bg-yellow-500/10 border border-yellow-500/25 rounded-xl px-4 py-3">
                      ⚠️ <strong>Atenção:</strong> seu projeto só é iniciado depois que você agir dentro da área — aprovar a letra, aceitar os termos, aprovar versões, entre outros.
                    </p>

                    <p className="text-gray-400 text-xs leading-relaxed mb-4">
                      ✨ Nessa área você também tem à disposição coleções, lembretes e muito mais.
                    </p>
                  </>
                )}

                {/* PRODUTO + VALOR + PEDIDO — recibo compacto, uma linha só (pago) */}
                {isPaid && order?.products && (
                  <div className="rounded-2xl p-4 mb-4 flex items-center justify-between border border-pink-500/20"
                       style={{ background: "linear-gradient(135deg, rgba(240,25,107,0.12), rgba(168,85,247,0.10))" }}>
                    <div>
                      <p className="text-xs text-pink-300 font-medium uppercase tracking-wider">{order.products.name}</p>
                      {orderId && (
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">Pedido #{orderId.slice(0, 8).toUpperCase()}</p>
                      )}
                    </div>
                    {order.payments?.amount != null && (
                      <p className="text-xl font-bold bg-gradient-to-r from-pink-400 to-fuchsia-400 bg-clip-text text-transparent">
                        R$ {Number(order.payments.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                )}

                {/* PRODUTO + VALOR — pendente/recebido, layout original */}
                {!isPaid && order?.products && (
                  <div className="rounded-2xl p-5 mb-4 flex items-center justify-between border border-pink-500/20"
                       style={{ background: "linear-gradient(135deg, rgba(240,25,107,0.12), rgba(168,85,247,0.10))" }}>
                    <div>
                      <p className="text-xs text-pink-300 font-medium mb-1 uppercase tracking-wider">Produto selecionado</p>
                      <p className="text-lg font-bold">{order.products.name}</p>
                    </div>
                    {order.payments?.amount != null && (
                      <p className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-fuchsia-400 bg-clip-text text-transparent">
                        R$ {Number(order.payments.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                )}

                {/* NÚMERO DO PEDIDO — logo abaixo do produto (pendente/recebido) */}
                {!isPaid && orderId && (
                  <div className="bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-center text-xs text-gray-400 mb-4 font-mono">
                    Pedido <span className="text-pink-300">#{orderId.slice(0, 8).toUpperCase()}</span>
                  </div>
                )}

                {/* PRÓXIMOS PASSOS — pendente/recebido; pago já viu tudo acima, sem duplicar */}
                {!isPaid && (
                  <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 mb-4">
                    <h2 className="text-base font-bold mb-3">Próximos passos ❤️</h2>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {isPending
                        ? "Seu pagamento está em análise. Assim que confirmado, você poderá aprovar a letra e liberar a produção na sua área."
                        : "Recebemos seu pedido. Assim que o pagamento for confirmado, você poderá aprovar a letra e liberar a produção na sua área."}
                    </p>
                    <p className="text-gray-300 text-sm leading-relaxed mt-3">
                      Qualquer dúvida, fale com a gente no{" "}
                      <a href="https://wa.me/5511996645678" target="_blank" rel="noopener noreferrer" className="text-pink-400 underline">WhatsApp</a>{" "}
                      ou por{" "}
                      <a href="mailto:contato@fizmusica.com.br" className="text-pink-400 underline">e-mail</a>.
                    </p>
                  </div>
                )}

                {/* Contato compacto (pago) */}
                {isPaid && (
                  <p className="text-gray-500 text-xs text-center mb-2">
                    Dúvida?{" "}
                    <a href="https://wa.me/5511996645678" target="_blank" rel="noopener noreferrer" className="text-pink-400 underline">WhatsApp</a>
                    {" "}·{" "}
                    <a href="mailto:contato@fizmusica.com.br" className="text-pink-400 underline">e-mail</a>
                  </p>
                )}

                {/* LINKS — acompanhar pedido (só quando ainda não pago) */}
                {orderId && !isPaid && (
                  <div className="text-center mt-5">
                    <button
                      onClick={() => router.push(`/minha-musica?orderId=${orderId}`)}
                      className="block w-full text-pink-400 hover:text-pink-300 transition-colors text-sm font-medium"
                    >
                      🎵 Acompanhar meu pedido
                    </button>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        <Footer />
      </div>
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

