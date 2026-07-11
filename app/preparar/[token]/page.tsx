"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import PreparoFlow from "../../minha-musica/PreparoFlow"
import FizMascot from "../../components/FizMascot"

type Order = {
  id: string
  paymentStatus: string
  status: string
  lyricsApproved: boolean
  honoreeName?: string | null
  subcategory?: string | null
  is_revision?: boolean
  slug?: string | null
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

  // Já entregue → manda pro player / área
  if (delivered && order.slug) {
    return (
      <Shell>
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎉</p>
          <h1 className="text-2xl font-bold mb-2">Sua música está pronta!</h1>
          <p className="text-white/50 text-sm mb-6">Acesse sua área para ouvir, baixar e compartilhar.</p>
          <a href="/minha-musica" className="inline-block px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
            Ouvir minha música →
          </a>
        </div>
      </Shell>
    )
  }

  // Aprovou agora (done) ou já estava aprovado → música sendo criada
  if (done || approved) {
    return (
      <Shell>
        <div className="text-center py-16">
          <FizMascot mood="energetic" />
          <h1 className="text-2xl font-bold mb-2 mt-2">Pronto! Sua música está sendo criada</h1>
          <p className="text-white/50 text-sm mb-6">
            Você não precisa fazer mais nada agora — avisaremos por <strong className="text-white/70">e-mail</strong> assim que ficar pronta.
            Você também pode acompanhar tudo na sua área.
          </p>
          <a href="/minha-musica" className="inline-block px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
            Acompanhar na minha área →
          </a>
        </div>
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
