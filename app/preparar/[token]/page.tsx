"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import PreparoFlow from "../../minha-musica/PreparoFlow"
import EscolherVersao from "../../minha-musica/EscolherVersao"
import FizMascot, { moodFromEmotion } from "../../components/FizMascot"

type Track = { audioId: string; audioUrl: string; imageUrl: string | null; title: string | null; duration: number | null }

type Order = {
  id: string
  paymentStatus: string
  status: string
  lyricsApproved: boolean
  honoreeName?: string | null
  subcategory?: string | null
  is_revision?: boolean
  emotion?: string | null
  sunoStatus?: string | null
  tracks?: Track[] | null
  slug?: string | null
}

// "Salve seu acesso": vincula o pedido do token à conta do cliente pra ele voltar
// de qualquer aparelho sem depender do e-mail. Sem sessão → botão do Google
// (guarda o token no localStorage; o /auth/callback traz de volta pra cá).
// Com sessão vinda desse fluxo → vincula sozinho. Sessão pré-existente → botão
// explícito (não "sequestra" o pedido de quem só abriu um link encaminhado).
function SalvarAcesso({ token }: { token: string }) {
  const [state, setState] = useState<"loading" | "anon" | "logged" | "saving" | "saved" | "other" | "error">("loading")

  async function vincular(accessToken: string) {
    setState("saving")
    try {
      const res = await fetch(`/api/preparar/${token}/vincular`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) { localStorage.removeItem("fm_vincular_token"); setState("saved"); return }
      if (res.status === 409) { localStorage.removeItem("fm_vincular_token"); setState("other"); return }
      setState("error")
    } catch {
      setState("error")
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session
      if (!session) { setState("anon"); return }
      // Voltou do Google iniciado aqui → completa o vínculo sozinho
      if (localStorage.getItem("fm_vincular_token") === token) { vincular(session.access_token); return }
      setState("logged")
    })
    // eslint-disable-next-line
  }, [token])

  async function handleGoogle() {
    localStorage.setItem("fm_vincular_token", token)
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleSalvarLogado() {
    const { data } = await supabase.auth.getSession()
    if (data.session) vincular(data.session.access_token)
  }

  if (state === "loading" || state === "other") return null

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
      {state === "saved" ? (
        <p className="text-green-400 text-sm font-semibold">
          ✓ Acesso salvo! Sua música te espera em{" "}
          <a href="/minha-musica" className="underline">Minha música</a>, de qualquer aparelho.
        </p>
      ) : state === "saving" ? (
        <p className="text-white/50 text-sm">Salvando seu acesso…</p>
      ) : state === "error" ? (
        <p className="text-white/50 text-sm">Não consegui salvar seu acesso agora — tente de novo mais tarde.</p>
      ) : state === "logged" ? (
        <>
          <p className="text-white/70 text-sm font-semibold mb-1">💾 Salvar este pedido na sua conta?</p>
          <p className="text-white/40 text-xs mb-3">Ele passa a aparecer em "Minha música" em qualquer aparelho.</p>
          <button onClick={handleSalvarLogado} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
            Salvar na minha conta
          </button>
        </>
      ) : (
        <>
          <p className="text-white/70 text-sm font-semibold mb-1">💾 Quer voltar sem precisar deste link?</p>
          <p className="text-white/40 text-xs mb-3">Salve seu acesso — um toque, sem senha.</p>
          <button onClick={handleGoogle} className="inline-flex items-center gap-2 bg-white text-gray-800 hover:bg-gray-100 transition-colors px-5 py-2.5 rounded-xl text-sm font-semibold">
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.5l-6.6-5.6C29.6 34.6 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.6 5.6C41.4 36.3 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
            Salvar meu acesso com Google
          </button>
        </>
      )}
    </div>
  )
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

export default function PrepararPage() {
  const { token } = useParams<{ token: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [done, setDone] = useState(false)

  async function load() {
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
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [token])

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

  const paid      = order.paymentStatus === "PAID"
  const delivered = order.status === "DELIVERED"
  const approved  = !!order.lyricsApproved
  // Versões liberadas, cliente ainda não escolheu a principal (sem slug). Tem
  // prioridade sobre o estado "sendo criada" — a música já está pronta pra ouvir.
  const escolhaPendente = paid && order.sunoStatus === "RELEASED" && !order.slug && (order.tracks?.length ?? 0) > 0

  // Pagamento pendente
  if (!paid) {
    return (
      <Shell>
        <div className="text-center py-16">
          <p className="text-4xl mb-3">⏳</p>
          <h1 className="text-2xl font-bold mb-2">Pagamento em análise</h1>
          <p className="text-white/50 text-sm">Assim que o pagamento for confirmado, você poderá aprovar a letra aqui. Avisaremos por e-mail.</p>
        </div>
      </Shell>
    )
  }

  // Versões prontas → escolher a principal SEM login (o endpoint escolher roda por
  // orderId). Ao escolher, recarrega e cai no estado "entregue" abaixo.
  if (escolhaPendente) {
    return (
      <Shell>
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
            Sua música <span className="bg-gradient-to-r from-pink-400 to-fuchsia-500 bg-clip-text text-transparent">ficou pronta!</span>
          </h1>
          <p className="text-white/50 text-sm mt-2">Ouça as versões e escolha a principal — sem precisar de senha.</p>
        </div>
        <EscolherVersao orderId={order.id} tracks={order.tracks!} onChosen={load} />
        <SalvarAcesso token={token} />
      </Shell>
    )
  }

  // Já entregue → manda direto pro player público (ouvir sem login). Baixar o MP3 e
  // o Termo de Entrega continuam na área do cliente, com login.
  if (delivered && order.slug) {
    return (
      <Shell>
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎉</p>
          <h1 className="text-2xl font-bold mb-2">Sua música está pronta!</h1>
          <p className="text-white/50 text-sm mb-6">Toque abaixo para ouvir e compartilhar. Para baixar o MP3, acesse sua área.</p>
          <a href={`/m/${order.slug}`} className="inline-block px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
            ▶ Ouvir minha música
          </a>
          <a href="/minha-musica" className="block mt-4 text-white/40 text-xs underline">Ir para minha área (baixar / compartilhar)</a>
        </div>
        <SalvarAcesso token={token} />
      </Shell>
    )
  }

  // Aprovou agora (done) ou já estava aprovado → música sendo criada
  if (done || approved) {
    return (
      <Shell>
        <div className="text-center py-16">
          <FizMascot mood={moodFromEmotion(order.emotion)} />
          <h1 className="text-2xl font-bold mb-2 mt-2">Pronto! Sua música está sendo criada</h1>
          <p className="text-white/50 text-sm mb-6">
            Você não precisa fazer mais nada agora — avisaremos por <strong className="text-white/70">e-mail</strong> assim que ficar pronta.
            Você também pode acompanhar tudo na sua área.
          </p>
          <a href="/minha-musica" className="inline-block px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
            Acompanhar na minha área →
          </a>
        </div>
        <SalvarAcesso token={token} />
      </Shell>
    )
  }

  // Caso principal: pago, não aprovado → fluxo de preparo
  const para = order.honoreeName ? `para ${order.honoreeName}` : ""
  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
          Vamos preparar a música <span className="bg-gradient-to-r from-pink-400 to-fuchsia-500 bg-clip-text text-transparent">{para}</span>
        </h1>
        <p className="text-white/50 text-sm mt-2">
          Aprove a letra e adicione as fotos. <strong className="text-white/70">Sua música só entra em produção depois que você aprovar a letra.</strong>
        </p>
      </div>
      <PreparoFlow
        orderId={order.id}
        photoToken={token}
        isRevision={order.is_revision}
        onApproved={() => setDone(true)}
      />
    </Shell>
  )
}
