"use client"

import { useState } from "react"

type Track = { audioId: string; audioUrl: string; imageUrl: string | null; title: string | null; duration: number | null }

// Passo "Escolher versão" — o cliente ouve as 2 variações e escolhe a favorita.
export default function EscolherVersao({
  orderId,
  tracks,
  onChosen,
}: {
  orderId: string
  tracks: Track[]
  onChosen?: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function escolher(audioId: string) {
    setBusy(audioId); setError("")
    try {
      const res = await fetch(`/api/orders/${orderId}/musica/escolher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioId }),
      })
      const d = await res.json()
      if (!d.ok) { setError(d.error ?? "Não consegui salvar sua escolha."); setBusy(null); return }
      onChosen?.()
    } catch {
      setError("Algo deu errado. Tente de novo.")
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/[0.07] p-5 mb-4">
      <div className="mb-4">
        <p className="text-fuchsia-100 font-semibold flex items-center gap-2">🎧 Sua música ficou pronta — em 2 versões!</p>
        <p className="text-white/55 text-xs mt-0.5">
          Você fica com as <strong>duas</strong>. Ouça e escolha qual será a <strong>principal</strong> — a do QR Code e do link de
          compartilhar. As duas continuam disponíveis para ouvir e baixar.
        </p>
      </div>

      <div className="space-y-3">
        {tracks.map((t, i) => (
          <div key={t.audioId} className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-white/70 text-sm font-medium mb-2">
              Versão {i + 1}{t.duration ? ` · ${Math.round(t.duration)}s` : ""}
            </p>
            <audio controls src={t.audioUrl} className="w-full h-10 mb-3" />
            <button
              onClick={() => escolher(t.audioId)}
              disabled={busy !== null}
              className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-all"
              style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
            >
              {busy === t.audioId ? "Salvando…" : `Usar a Versão ${i + 1} como principal`}
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
    </div>
  )
}
