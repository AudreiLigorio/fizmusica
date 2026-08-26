"use client"

import { useEffect, useRef, useState } from "react"

const MAX_TITULO = 60

// Campo do nome da música, no passo de aprovar a letra. A sugestão vem da IA
// já preenchida — se o cliente não mexer, é ela que vale.
//
// A sugestão é pedida na hora, nunca cacheada: o cliente ainda tem revisões de
// letra, e um título guardado antes ficaria desalinhado quando a letra mudasse.
export default function TituloMusica({
  orderId,
  lyrics,
  value,
  onChange,
  disabled,
}: {
  orderId: string
  lyrics: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState("")
  // Sugere uma vez por letra — sem isso, cada tecla digitada na letra
  // dispararia uma chamada nova à IA.
  const sugeridoPara = useRef<string | null>(null)

  async function sugerir(manual = false) {
    if (!lyrics.trim()) return
    setBusy(true); setErro("")
    try {
      const res = await fetch(`/api/orders/${orderId}/titulo/sugestao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics }),
      })
      const d = await res.json().catch(() => ({}))
      if (d.titulo) onChange(String(d.titulo).slice(0, MAX_TITULO))
      else if (manual) setErro("Não consegui sugerir agora. Escreva o nome que preferir.")
    } catch {
      if (manual) setErro("Não consegui sugerir agora. Escreva o nome que preferir.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const base = lyrics.trim()
    if (!base || value.trim() || sugeridoPara.current === base) return
    sugeridoPara.current = base
    sugerir()
  }, [lyrics, value]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 mt-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label htmlFor={`titulo-${orderId}`} className="text-xs font-semibold text-fuchsia-200">
          🏷️ Nome da sua música
        </label>
        <button
          type="button"
          onClick={() => sugerir(true)}
          disabled={busy || disabled || !lyrics.trim()}
          className="shrink-0 text-[11px] text-white/50 hover:text-fuchsia-300 disabled:opacity-40 transition-colors"
        >
          {busy ? "Pensando…" : "🔄 Sugerir outro"}
        </button>
      </div>

      <input
        id={`titulo-${orderId}`}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_TITULO))}
        maxLength={MAX_TITULO}
        disabled={disabled}
        placeholder={busy ? "Criando um nome…" : "Ex: O Abraço que Ficou"}
        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/60 transition-colors disabled:opacity-50"
      />

      <p className="text-[11px] text-white/35 mt-1.5 leading-relaxed">
        É o nome que aparece no player e no seu link de compartilhar. Pode
        deixar a sugestão ou escrever o seu. {value.length}/{MAX_TITULO}
      </p>

      {erro && <p className="text-red-400 text-[11px] mt-1.5">{erro}</p>}
    </div>
  )
}
