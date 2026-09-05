"use client"

import { useEffect, useState } from "react"
import TituloMusica from "./TituloMusica"

type State = {
  lyricsDraft: string | null
  lyricsApproved: boolean
  reprocessLeft: number
  reprocessUsed: number
}

type Busy = "gerar" | "reprocessar" | "aprovar" | null

function friendlyError(msg: string): string {
  if (/503|overloaded|unavailable/i.test(msg)) return "A IA está sobrecarregada agora. Tente de novo em alguns minutos."
  if (/429|quota|rate/i.test(msg)) return "Limite de uso atingido. Tente de novo em alguns minutos."
  if (/timeout|timed out/i.test(msg)) return "A geração demorou demais. Tente novamente."
  if (/não retornou|empty/i.test(msg)) return "A IA não conseguiu gerar a letra. Tente novamente."
  return "Algo deu errado. Tente de novo em instantes."
}

async function readStream(
  res: Response,
  onChunk: (text: string) => void,
): Promise<{ error?: string; meta?: Record<string, unknown> }> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Extrai marcadores especiais (\x00ERR: e \x00META:) do final do buffer
    const errIdx = buffer.indexOf("\x00ERR:")
    if (errIdx !== -1) {
      const text = buffer.slice(0, errIdx)
      if (text) onChunk(text)
      return { error: buffer.slice(errIdx + 5) }
    }
    const metaIdx = buffer.indexOf("\x00META:")
    if (metaIdx !== -1) {
      const text = buffer.slice(0, metaIdx)
      if (text) onChunk(text)
      try { return { meta: JSON.parse(buffer.slice(metaIdx + 6)) } } catch { return {} }
    }
    onChunk(buffer)
    buffer = ""
  }
  return {}
}

export default function LetraPanel({
  orderId,
  onApproved,
  flowMode,
  onState,
  onEditor,
}: {
  orderId: string
  onApproved?: () => void
  flowMode?: boolean
  onState?: (s: { lyrics: string; canApprove: boolean }) => void
  // Entrega o setter da letra pra quem monta este painel.
  //
  // Existe por causa dos blocos de estrutura: marcar "solo de guitarra"
  // precisa ESCREVER na letra, e a letra mora aqui. Sem essa ponte, o card
  // teria uma cópia própria do texto e as duas divergiriam — o cliente veria
  // uma letra na tela e outra seria enviada pra geração.
  onEditor?: (api: { setText: (t: string) => void }) => void
}) {
  const [state, setState]   = useState<State | null>(null)
  const [text, setText]     = useState("")
  const [lastAiText, setLastAiText] = useState("")
  const [instrucao, setInstrucao] = useState("")
  const [titulo, setTitulo] = useState("")
  const [loading, setLoading] = useState(true)

  // Uma vez só: `setText` é estável (vem do useState), então não recria a
  // ponte a cada render.
  useEffect(() => { onEditor?.({ setText }) }, [onEditor])
  const [busy, setBusy]     = useState<Busy>(null)
  const [error, setError]   = useState("")
  const [confirmCfg, setConfirmCfg] = useState<{ title: string; message: string; confirmLabel: string; resolve: (v: boolean) => void } | null>(null)

  function askConfirm(cfg: { title: string; message: string; confirmLabel: string }): Promise<boolean> {
    return new Promise((resolve) => setConfirmCfg({ ...cfg, resolve }))
  }

  async function loadState() {
    try {
      const d = await fetch(`/api/orders/${orderId}/letra`).then((r) => r.json())
      if (d.error) return
      setState({
        lyricsDraft: d.lyricsDraft,
        lyricsApproved: d.lyricsApproved,
        reprocessLeft: d.reprocessLeft,
        reprocessUsed: d.reprocessUsed,
      })
      if (d.lyricsDraft && !text) { setText(d.lyricsDraft); setLastAiText(d.lyricsDraft) }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadState() }, [orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Modo fluxo: informa o pai (página) a letra atual + se já pode aprovar.
  useEffect(() => {
    if (!flowMode || !onState || !state) return
    const has = !!text.trim()
    const semRev = state.reprocessLeft <= 0
    const edit = text.trim() !== lastAiText.trim()
    onState({ lyrics: text, canApprove: has && (!edit || semRev) })
  }, [text, lastAiText, state, flowMode]) // eslint-disable-line react-hooks/exhaustive-deps

  async function gerar() {
    setBusy("gerar"); setError(""); setText("")
    try {
      const res = await fetch(`/api/orders/${orderId}/letra/gerar`, { method: "POST" })
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}))
        setError(friendlyError(d.error ?? ""))
        return
      }
      let accumulated = ""
      const { error: streamErr } = await readStream(res, (chunk) => {
        accumulated += chunk
        setText(accumulated)
      })
      if (streamErr) { setError(friendlyError(streamErr)); setText("") ; return }
      setLastAiText(accumulated.trim())
      await loadState()
    } catch {
      setError("Não consegui gerar agora. Tente de novo em instantes.")
    } finally {
      setBusy(null)
    }
  }

  async function reprocessar() {
    if (state && state.reprocessLeft === 1) {
      const ok = await askConfirm({
        title: "Última revisão",
        message: "Esta é sua última revisão com a IA. Após isso, não será possível pedir mais alterações automáticas — você poderá apenas aprovar a letra. Deseja continuar?",
        confirmLabel: "Sim, revisar",
      })
      if (!ok) return
    }
    setBusy("reprocessar"); setError("")
    try {
      const res = await fetch(`/api/orders/${orderId}/letra/reprocessar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: text, instrucao }),
      })
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}))
        setError(friendlyError(d.error ?? ""))
        return
      }
      let accumulated = ""
      const { error: streamErr, meta } = await readStream(res, (chunk) => {
        accumulated += chunk
        setText(accumulated)
      })
      if (streamErr) { setError(friendlyError(streamErr)); return }
      setLastAiText(accumulated.trim())
      setInstrucao("")
      if (meta && state) {
        setState({ ...state, reprocessLeft: (meta.reprocessLeft as number) ?? state.reprocessLeft, reprocessUsed: (meta.reprocessUsed as number) ?? state.reprocessUsed })
      } else {
        await loadState()
      }
    } catch {
      setError("Não consegui revisar agora. Tente de novo em instantes.")
    } finally {
      setBusy(null)
    }
  }

  async function aprovar() {
    if (state && state.reprocessLeft > 0) {
      const ok = await askConfirm({
        title: "Aprovar a letra?",
        message: "Após a aprovação não será possível fazer alterações. Quer aprovar esta letra para a produção da música?",
        confirmLabel: "Aprovar letra",
      })
      if (!ok) return
    }
    setBusy("aprovar"); setError("")
    try {
      const res = await fetch(`/api/orders/${orderId}/letra/aprovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: text, musicName: titulo }),
      })
      const d = await res.json()
      if (d.error) { setError(friendlyError(d.error)); return }
      await loadState(); onApproved?.()
    } catch {
      setError("Não consegui aprovar agora. Tente de novo.")
    } finally {
      setBusy(null)
    }
  }

  if (loading || !state) return null

  if (state.lyricsApproved) {
    return (
      <div className="rounded-xl border border-green-500/25 bg-green-500/8 px-4 py-3 mb-4">
        <p className="text-green-300 text-sm font-semibold">✅ Letra aprovada</p>
        <p className="text-green-400/70 text-xs">Sua letra está salva. A produção da sua música começa agora.</p>
      </div>
    )
  }

  const hasLyrics = !!text.trim()
  const semRevisoes = state.reprocessLeft <= 0
  const editado = text.trim() !== lastAiText.trim()
  const podeAprovar = !editado || semRevisoes

  return (
    <>
    {confirmCfg && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={() => { confirmCfg.resolve(false); setConfirmCfg(null) }}>
        <div onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl border border-fuchsia-500/30 bg-[#1a0f24] p-6 shadow-2xl">
          <p className="text-white font-semibold text-base mb-2">{confirmCfg.title}</p>
          <p className="text-white/60 text-sm leading-relaxed mb-5">{confirmCfg.message}</p>
          <div className="flex gap-3">
            <button
              onClick={() => { confirmCfg.resolve(false); setConfirmCfg(null) }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/70 border border-white/15 hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => { confirmCfg.resolve(true); setConfirmCfg(null) }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
            >
              {confirmCfg.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.06] p-5 mb-4">
      <div className="mb-4">
        <p className="text-fuchsia-200 font-semibold flex items-center gap-2">🎼 Sua letra</p>
        {/* A explicação dos colchetes passou a ser necessária quando o
            compositor virou obrigado a marcar a estrutura: antes eles
            apareciam de vez em quando, agora aparecem SEMPRE, e sem uma
            linha explicando parecem defeito no meio de uma homenagem.
            Os players já removem essas linhas, então elas nunca são
            exibidas na música pronta nem cantadas. */}
        <p className="text-white/50 text-xs mt-0.5">
          Gere a letra, ajuste o que quiser e aprove antes da produção da música.
        </p>
        <p className="text-white/35 text-[11px] mt-1">
          As marcações entre colchetes — <span className="text-white/50">[Refrão]</span>, <span className="text-white/50">[Ponte]</span> — organizam a música e <strong className="text-white/50">não são cantadas</strong>. Pode deixá-las como estão.
        </p>
      </div>

      {!hasLyrics ? (
        <button
          onClick={gerar}
          disabled={busy !== null}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-all"
          style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 4px 20px rgba(240,25,107,0.35)" }}
        >
          {busy === "gerar" ? "Compondo sua letra…" : "✨ Gerar minha letra"}
        </button>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            disabled={busy === "gerar" || busy === "reprocessar" || semRevisoes}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm leading-relaxed outline-none focus:border-fuchsia-500/60 transition-colors whitespace-pre-wrap disabled:opacity-80"
            placeholder="A letra aparece aqui…"
          />

          {busy === "gerar" && (
            <p className="text-fuchsia-300/70 text-xs mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse inline-block" />
              Compondo…
            </p>
          )}

          {/* Revisão com IA */}
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <input
              value={instrucao}
              onChange={(e) => setInstrucao(e.target.value)}
              disabled={busy !== null || semRevisoes}
              placeholder="O que você quer ajustar? (opcional)"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/60 transition-colors mb-2 disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-3">
              <span className={`text-xs ${semRevisoes ? "text-white/30" : "text-fuchsia-300/80"}`}>
                {semRevisoes ? "Sem revisões com IA — ajuste à mão e aprove" : `${state.reprocessLeft} de 3 revisões restantes`}
              </span>
              <button
                onClick={reprocessar}
                disabled={busy !== null || semRevisoes}
                className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold text-white border border-fuchsia-500/40 bg-fuchsia-500/15 hover:bg-fuchsia-500/25 disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                {busy === "reprocessar" ? (
                  <><span className="w-3 h-3 border-2 border-fuchsia-300 border-t-transparent rounded-full animate-spin" /> Revisando…</>
                ) : "🔁 Pedir revisão à IA"}
              </button>
            </div>
          </div>

          {editado && !semRevisoes && (
            <p className="text-yellow-400/80 text-xs mt-3">
              Você editou a letra — peça uma revisão à IA antes de continuar.
            </p>
          )}

          {/* No modo fluxo, a aprovação fica no passo final (página). Aqui só geramos/revisamos. */}
          {!flowMode && (
            <>
            <TituloMusica
              orderId={orderId}
              lyrics={text}
              value={titulo}
              onChange={setTitulo}
              disabled={busy !== null}
            />
            <button
              onClick={aprovar}
              disabled={busy !== null || !podeAprovar}
              className="w-full mt-3 py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
              style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", boxShadow: "0 4px 20px rgba(34,197,94,0.3)" }}
            >
              {busy === "aprovar" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Aprovando…
                </span>
              ) : "✅ Aprovar letra"}
            </button>
            </>
          )}
        </>
      )}

      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
    </div>
    </>
  )
}
