"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

type State = "loading" | "ready" | "submitting" | "done" | "already" | "invalid"

export default function FeedbackPage() {
  const { token } = useParams<{ token: string }>()

  const [state, setState] = useState<State>("loading")
  const [nome, setNome]   = useState("")
  const [subcategory, setSubcategory] = useState("")

  // Respostas
  const [rating,      setRating]      = useState(0)
  const [hovered,     setHovered]     = useState(0)
  const [highlight,   setHighlight]   = useState("")
  const [improvement, setImprovement] = useState("")
  const [error,       setError]       = useState("")

  useEffect(() => {
    fetch(`/api/feedback/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error)            return setState("invalid")
        if (d.alreadySubmitted) return setState("already")
        setNome(d.nome ?? "")
        setSubcategory(d.subcategory ?? "")
        setState("ready")
      })
      .catch(() => setState("invalid"))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (rating === 0)        return setError("Por favor, dê uma nota de 1 a 5 estrelas.")
    if (!highlight.trim())   return setError("Conte o que mais te marcou na sua experiência.")
    setState("submitting")
    const res  = await fetch(`/api/feedback/${token}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ rating, highlight, improvement }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? "Erro ao enviar. Tente novamente."); setState("ready") }
    else          setState("done")
  }

  const firstName = nome.split(" ")[0] ?? "você"

  // ── Loading ──
  if (state === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-[#07060d]">
      <span className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Inválido ──
  if (state === "invalid") return (
    <Page>
      <div className="text-center py-10">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-xl font-bold mb-2">Link inválido ou expirado</h2>
        <p className="text-gray-500 text-sm">Este link de avaliação não existe ou já expirou.</p>
      </div>
    </Page>
  )

  // ── Já respondeu ──
  if (state === "already") return (
    <Page>
      <div className="text-center py-10">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold mb-2">Avaliação já enviada!</h2>
        <p className="text-gray-500 text-sm">Você já avaliou sua experiência. Muito obrigado pelo seu feedback!</p>
      </div>
    </Page>
  )

  // ── Sucesso ──
  if (state === "done") return (
    <Page>
      <div className="text-center py-6">
        <div className="text-6xl mb-5 animate-bounce">🎉</div>
        <h2 className="text-2xl font-bold mb-3">Obrigado, {firstName}!</h2>
        <p className="text-gray-400 mb-6 leading-relaxed">
          Seu feedback é muito importante para seguirmos criando experiências incríveis.<br />
          Ficamos felizes em fazer parte deste momento especial! ❤️
        </p>
        <a href="https://fizmusica.com.br"
          className="inline-block bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white px-8 py-3 rounded-full font-semibold text-sm transition hover:opacity-90">
          🎵 Criar outra música
        </a>
      </div>
    </Page>
  )

  // ── Formulário ──
  return (
    <Page>
      <div className="mb-6 text-center">
        <div className="text-4xl mb-3">🎵</div>
        <h2 className="text-xl font-bold mb-1">Como foi sua experiência?</h2>
        <p className="text-gray-500 text-sm">
          {subcategory ? `Seu pedido de ${subcategory} ` : "Seu pedido "} foi entregue — conta pra gente como foi do início ao fim!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-7">

        {/* Pergunta 1 — Nota com estrelas */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-sm font-semibold mb-1">1. Como você avalia sua experiência com a FizMusica?</p>
          <p className="text-xs text-gray-500 mb-4">Considere tudo: a música, o atendimento e a entrega. Dê uma nota de 1 a 5 estrelas</p>
          <div className="flex gap-3 justify-center">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                className="text-4xl transition-transform hover:scale-110 focus:outline-none"
                style={{ filter: n <= (hovered || rating) ? "none" : "grayscale(1) opacity(0.3)" }}
              >
                ⭐
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center mt-3 text-sm font-medium text-pink-400">
              {["", "Muito ruim 😞", "Ruim 😕", "Ok 😐", "Bom 😊", "Incrível! 🤩"][rating]}
            </p>
          )}
        </div>

        {/* Pergunta 2 — Ponto alto (obrigatório) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-sm font-semibold mb-1">
            2. O que mais te surpreendeu ou emocionou na sua experiência?
            <span className="text-pink-400 ml-1">*</span>
          </p>
          <p className="text-xs text-gray-500 mb-3">Pode ser a música, o atendimento, a entrega, um detalhe que te marcou…</p>
          <textarea
            rows={3}
            value={highlight}
            onChange={e => setHighlight(e.target.value)}
            placeholder="Ex: A parte da letra que falou sobre nosso primeiro encontro me fez chorar de emoção…"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-500 transition-colors resize-none placeholder-gray-600"
          />
        </div>

        {/* Pergunta 3 — Melhoria (opcional) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-sm font-semibold mb-1">3. Se pudesse mudar algo, o que seria?</p>
          <p className="text-xs text-gray-500 mb-3">Opcional — sua resposta nos ajuda a melhorar cada vez mais</p>
          <textarea
            rows={3}
            value={improvement}
            onChange={e => setImprovement(e.target.value)}
            placeholder="Ex: Gostaria que a música fosse um pouco mais animada, ou que a letra mencionasse o nome dela…"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-500 transition-colors resize-none placeholder-gray-600"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            ⚠️ {error}
          </p>
        )}

        <button
          type="submit"
          disabled={state === "submitting"}
          className="w-full bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white py-4 rounded-2xl font-bold text-base transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {state === "submitting" ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando…</>
          ) : "Enviar avaliação 💜"}
        </button>

        <p className="text-center text-xs text-gray-600">Leva menos de 2 minutos e faz toda a diferença pra nós ❤️</p>
      </form>
    </Page>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07060d] text-white flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <a href="https://fizmusica.com.br"
            className="inline-block text-2xl font-extrabold bg-gradient-to-r from-pink-400 to-fuchsia-400 bg-clip-text text-transparent">
            FizMusica
          </a>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 lg:p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  )
}
