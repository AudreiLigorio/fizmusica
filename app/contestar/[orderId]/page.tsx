"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Header from "@/app/components/Header"
import MicButton from "@/app/components/MicButton"

export default function ContestarPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()

  const [message, setMessage]   = useState("")
  const [interim, setInterim]   = useState("")
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState("")
  const [authReady, setAuthReady] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push("/entrar")
      else setAuthReady(true)
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) { setError("Descreva o que deseja alterar."); return }
    setSending(true)
    setError("")

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/orders/${orderId}/contestar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ message }),
    })
    const d = await res.json()
    setSending(false)

    if (res.ok) setSent(true)
    else setError(d.error ?? "Erro ao enviar.")
  }

  if (!authReady) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#07060d" }}>
      <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen text-white font-sans" style={{ background: "#07060d" }}>
      <Header showButton={false} />

      <div className="max-w-xl mx-auto px-5 pt-28 pb-20">

        {sent ? (
          <div className="text-center">
            <div className="text-5xl mb-5">✅</div>
            <h1 className="text-2xl font-bold mb-3">Solicitação enviada!</h1>
            <p className="text-white/55 text-sm leading-relaxed mb-8">
              Nossa equipe vai analisar e entrar em contato. Acompanhe o status na sua área.
            </p>
            <button
              onClick={() => router.push("/minha-musica")}
              className="px-6 py-3 rounded-2xl font-semibold text-sm transition-all hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
            >
              ← Voltar para minha área
            </button>
          </div>
        ) : (
          <>
            <button onClick={() => router.back()} className="text-sm text-white/40 hover:text-white/80 transition-colors mb-8">
              ← Voltar
            </button>

            {/* Cabeçalho */}
            <div className="mb-8">
              <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-3" style={{ color: "#f0196b" }}>
                Solicitar revisão
              </p>
              <h1 className="text-2xl font-bold mb-3">O que você quer mudar?</h1>
              <p className="text-white/55 text-sm leading-relaxed">
                Você tem <strong className="text-white">uma revisão gratuita</strong>. Use bem esse espaço — detalhe tudo o que ficou faltando ou que quer diferente.
              </p>
            </div>

            {/* Aviso importante */}
            <div className="rounded-2xl p-4 mb-6 border border-orange-500/25 bg-orange-500/8">
              <p className="text-orange-300 text-xs font-semibold uppercase tracking-wider mb-2">⚠️ Atenção antes de enviar</p>
              <ul className="text-orange-200/70 text-sm space-y-1.5 leading-relaxed">
                <li>• A melodia e letra atuais <strong className="text-orange-200">serão descartadas</strong> — a música será refeita do zero.</li>
                <li>• Esta é sua <strong className="text-orange-200">última revisão gratuita</strong>. Para novas alterações depois disso, será necessário fazer um novo pedido.</li>
                <li>• Acrescente apenas o que <strong className="text-orange-200">ficou faltando</strong>: estilo, voz, detalhes da história, tom emocional.</li>
              </ul>
            </div>

            {/* Confirmação antes de exibir o formulário */}
            {!confirmed ? (
              <div className="text-center py-4">
                <p className="text-white/60 text-sm mb-5">Entendeu as condições e quer continuar?</p>
                <button
                  onClick={() => setConfirmed(true)}
                  className="px-8 py-3 rounded-2xl font-bold text-sm border border-orange-500/40 text-orange-300 hover:bg-orange-500/10 transition-colors"
                >
                  Sim, entendi — quero solicitar revisão
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-white/60 font-medium block mb-2">
                    Descreva tudo o que quer alterar
                    <span className="text-white/30 text-xs ml-1">(seja o mais detalhado possível)</span>
                  </label>
                  <div className="relative">
                    <textarea
                      ref={textRef}
                      value={message + interim}
                      onChange={(e) => { setMessage(e.target.value); setInterim("") }}
                      placeholder="Ex: A voz ficou muito grave, prefiro feminina. Acrescenta que a gente se conheceu numa viagem pra Fernando de Noronha em 2019. O tom tá muito animado, quero mais emocionante e melancólico..."
                      rows={8}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 outline-none focus:border-pink-500 transition-colors resize-none text-sm leading-relaxed"
                    />
                    {interim && (
                      <p className="text-white/30 text-xs italic px-4 pb-2">…{interim}</p>
                    )}
                    <div className="absolute bottom-3 right-3">
                      <MicButton
                        onResult={(t) => setMessage((prev) => prev + (prev ? " " : "") + t)}
                        onInterim={setInterim}
                        size="md"
                      />
                    </div>
                  </div>
                </div>

                {/* Dicas */}
                <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 text-xs text-white/40 space-y-1">
                  <p className="text-white/60 font-semibold mb-2">💡 O que ajuda a gente a fazer melhor:</p>
                  <p>• Estilo musical ou ritmo preferido (ex.: MPB mais lenta, sertanejo romântico)</p>
                  <p>• Tipo de voz (feminina, masculina, suave, potente)</p>
                  <p>• Detalhes da história que ficaram de fora</p>
                  <p>• Tom emocional que você esperava (mais alegre, mais emocionante, mais íntimo)</p>
                  <p>• O que você gostou e quer manter</p>
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="w-full py-4 rounded-2xl font-bold text-sm transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
                >
                  {sending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enviando…
                    </span>
                  ) : "Enviar solicitação de revisão →"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
