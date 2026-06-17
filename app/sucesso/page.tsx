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

        <div className="flex items-center justify-center px-5 pt-20 pb-16 min-h-screen">
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
                      ? "Pagamento confirmado! Já vamos iniciar a produção da sua música."
                      : isPending
                      ? "Seu pagamento está sendo processado. Assim que confirmar, começamos."
                      : "Seu pedido foi recebido e já vamos preparar sua música personalizada."}
                  </p>
                </div>

                {/* ⭐ DESTAQUE: ANEXAR FOTOS */}
                {isPaid && order?.photo_token && (
                  <a
                    href={`/pedido/${order.photo_token}/fotos`}
                    className="group block rounded-3xl p-7 mb-6 relative overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.99]"
                    style={{
                      background: "linear-gradient(135deg, #f0196b 0%, #d946ef 55%, #a855f7 100%)",
                      boxShadow: "0 16px 50px rgba(217,70,239,0.35)",
                    }}
                  >
                    <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl shrink-0">📸</span>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-white/80">Deixe com a sua cara</span>
                      </div>
                      <h2 className="text-2xl font-bold leading-tight mb-1">Adicione fotos à sua música</h2>
                      <p className="text-white/85 text-sm leading-relaxed mb-5">
                        Até <strong>5 fotos</strong> que vão aparecer no player enquanto a música toca. Escolha uma como capa. É rápido e opcional.
                      </p>
                      <span className="inline-flex items-center gap-2 bg-white text-pink-600 font-bold text-sm px-6 py-3 rounded-2xl shadow-lg group-hover:gap-3 transition-all">
                        📸 Anexar minhas fotos
                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                      </span>
                      <p className="text-white/60 text-[11px] mt-3">Enviamos esse link também no seu e-mail — dá pra fazer depois.</p>
                    </div>
                  </a>
                )}

                {/* PRODUTO + VALOR */}
                {order?.products && (
                  <div className="rounded-2xl p-5 mb-4 flex items-center justify-between border border-pink-500/20"
                       style={{ background: "linear-gradient(135deg, rgba(240,25,107,0.12), rgba(168,85,247,0.10))" }}>
                    <div>
                      <p className="text-xs text-pink-300 font-medium mb-1 uppercase tracking-wider">Produto selecionado</p>
                      <p className="text-lg font-bold">{order.products.name}</p>
                    </div>
                    {order.payments?.amount && (
                      <p className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-fuchsia-400 bg-clip-text text-transparent">
                        R$ {Number(order.payments.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                )}

                {/* PRÓXIMOS PASSOS */}
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 mb-4">
                  <h2 className="text-base font-bold mb-4">Próximos passos ❤️</h2>
                  <div className="space-y-3">
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
                      <div key={emoji} className="flex gap-3 items-start">
                        <span className="text-lg shrink-0">{emoji}</span>
                        <p className="text-gray-300 text-sm leading-relaxed">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* NÚMERO DO PEDIDO */}
                {orderId && (
                  <div className="bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-center text-xs text-gray-400 mb-4 font-mono">
                    Pedido <span className="text-pink-300">#{orderId.slice(0, 8).toUpperCase()}</span>
                  </div>
                )}

                {/* WHATSAPP */}
                <a
                  href="https://wa.me/5511996645678"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full bg-green-500 hover:bg-green-600 transition-all py-4 rounded-2xl text-lg font-bold shadow-2xl shadow-green-500/20"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Falar no WhatsApp
                </a>

                {/* MINHA ÁREA */}
                {isPaid && (
                  <button
                    onClick={() => router.push(`/minha-musica?orderId=${orderId ?? ""}`)}
                    className="w-full mt-3 bg-white/[0.06] border border-white/15 hover:bg-white/10 transition-all py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    🎧 Entrar na minha área — acompanhar e ouvir
                  </button>
                )}

                {/* LINKS */}
                <div className="text-center mt-5 space-y-2">
                  {orderId && !isPaid && (
                    <button
                      onClick={() => router.push(`/minha-musica?orderId=${orderId}`)}
                      className="block w-full text-pink-400 hover:text-pink-300 transition-colors text-sm font-medium"
                    >
                      🎵 Acompanhar meu pedido
                    </button>
                  )}
                  <button
                    onClick={() => router.push("/")}
                    className="block w-full text-gray-500 hover:text-gray-300 transition-colors text-sm"
                  >
                    ← Voltar para a página inicial
                  </button>
                </div>
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

