"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import { useQuickLogin } from "../../hooks/useQuickLogin"

type Order = {
  id: string
  paymentStatus: string
  email?: string | null
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen text-white font-sans overflow-hidden" style={{ background: "#07060d" }}>
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0" style={{ background: "radial-gradient(55% 45% at 12% 6%, rgba(240,25,107,0.24) 0%, transparent 60%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(55% 50% at 90% 96%, rgba(168,85,247,0.22) 0%, transparent 62%)" }} />
      </div>
      <div className="relative z-10">
        <Header showButton={false} />
        <section className="max-w-2xl mx-auto px-5 pt-24 pb-16">{children}</section>
        <Footer />
      </div>
    </div>
  )
}

// Ponte pós-pagamento: resolve o token, exige login (o token vira prova de
// posse pra vincular o pedido à conta) e manda pra /minha-musica — o destino
// único de verdade, que já sabe renderizar todo estado do pedido (aguardando,
// escolher versão, sendo criada, entregue, preparo). Essa página nunca mostra
// esses estados sozinha; ela só decide "esse pedido é seu, agora entra".
export default function PrepararPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [session, setSession] = useState<"loading" | "anon" | "linking" | "blocked">("loading")
  const [blockedReason, setBlockedReason] = useState("")

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/preparar/${token}`, { cache: "no-store" })
        if (!res.ok) { setNotFound(true); return }
        const d = await res.json()
        setOrder(d.order ?? null)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  const paid = order?.paymentStatus === "PAID"

  // Vincula o pedido à conta logada e manda pra /minha-musica — mesma ponte
  // pra quem chega já logado e pra quem acabou de voltar do login.
  async function vincularEEntrar(accessToken: string) {
    setSession("linking")
    try {
      const res = await fetch(`/api/preparar/${token}/vincular`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.status === 409) {
        setSession("blocked")
        setBlockedReason("Este pedido já está salvo em outra conta.")
        return
      }
      // ok:true (com ou sem `already`) — e mesmo se a chamada falhar por outro
      // motivo, segue pra área: o pedido pode já estar vinculado por e-mail.
      router.replace(`/minha-musica?orderId=${order?.id ?? ""}`)
    } catch {
      router.replace(`/minha-musica?orderId=${order?.id ?? ""}`)
    }
  }

  useEffect(() => {
    if (!paid || !order) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { vincularEEntrar(data.session.access_token); return }
      setSession("anon")
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paid, order])

  const quickLogin = useQuickLogin(order?.email, token)

  async function handleSair() {
    await supabase.auth.signOut()
    setBlockedReason("")
    setSession("anon")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07060d" }}>
        <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <Shell>
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🔍</p>
          <h1 className="text-2xl font-bold mb-2">Link não encontrado</h1>
          <p className="text-white/50 text-sm">Este link de preparo é inválido ou expirou. Acesse sua área para continuar.</p>
          <a href="/minha-musica" className="inline-block mt-6 px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
            Ir para minha área →
          </a>
        </div>
      </Shell>
    )
  }

  // Pagamento pendente — nada pra vincular ainda, sem exigir login
  if (!paid) {
    return (
      <Shell>
        <div className="text-center py-16">
          <p className="text-4xl mb-3">⏳</p>
          <h1 className="text-2xl font-bold mb-2">Pagamento em análise</h1>
          <p className="text-white/50 text-sm">Assim que o pagamento for confirmado, você poderá entrar na sua área aqui. Avisaremos por e-mail.</p>
        </div>
      </Shell>
    )
  }

  // Pedido já vinculado a outra conta — não dá pra "roubar" ele
  if (session === "blocked") {
    return (
      <Shell>
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🔒</p>
          <h1 className="text-2xl font-bold mb-2">Pedido de outra conta</h1>
          <p className="text-white/50 text-sm mb-6">{blockedReason} Entre com ela pra continuar, ou saia e tente outra.</p>
          <button onClick={handleSair} className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
            Sair e entrar com outra conta
          </button>
        </div>
      </Shell>
    )
  }

  // Logando ou vinculando — mesma tela de espera, sem piscar conteúdo
  if (session === "loading" || session === "linking") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07060d" }}>
        <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // session === "anon" — pedido pago, ninguém logado: pede login antes de
  // entrar (o token prova que esse pedido é dela; login vira dono de verdade)
  return (
    <Shell>
      <div className="text-center py-12">
        <p className="text-4xl mb-3">🎵</p>
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2">Sua música te espera</h1>
        <p className="text-white/50 text-sm mb-8 max-w-sm mx-auto">
          Entre pra aprovar a letra, adicionar fotos e acompanhar tudo na sua área.
        </p>

        {quickLogin.emailSent ? (
          <p className="text-white/80 text-sm bg-white/5 border border-white/10 rounded-2xl px-5 py-4 max-w-sm mx-auto">
            📧 Enviamos um link de acesso para <strong className="text-white">{order.email}</strong>. Clique nele pra entrar.
          </p>
        ) : (
          <div className="max-w-sm mx-auto">
            <button
              onClick={quickLogin.withGoogle}
              className="w-full inline-flex items-center justify-center gap-2 bg-white text-gray-800 hover:bg-gray-100 transition-colors font-bold text-sm px-6 py-3 rounded-2xl shadow-lg"
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.5l-6.6-5.6C29.6 34.6 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.6 5.6C41.4 36.3 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
              Entrar com Google
            </button>
            {order.email && (
              <button
                onClick={quickLogin.withEmail}
                disabled={quickLogin.sending}
                className="w-full text-center text-white/50 hover:text-white/80 text-xs underline underline-offset-2 mt-4 disabled:opacity-60"
              >
                {quickLogin.sending ? "Enviando…" : `Prefiro por e-mail (${order.email})`}
              </button>
            )}
            {quickLogin.error && (
              <p className="text-red-300 text-xs mt-3 bg-red-500/10 rounded-lg px-3 py-2">{quickLogin.error}</p>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}
