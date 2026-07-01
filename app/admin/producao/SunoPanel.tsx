"use client"

import { useEffect, useState } from "react"

type Track = { audioId: string; audioUrl: string; imageUrl: string | null; title: string | null; duration: number | null }

// Painel da geração de música por IA (Suno) no admin da fila de produção.
// Estados: null (não gerado) | GENERATING | READY (aguardando liberar) | RELEASED | FAILED.
export default function SunoPanel({
  orderId,
  status,
  tracks,
  error,
}: {
  orderId: string
  status: string | null
  tracks: Track[] | null
  error: string | null
}) {
  const [busy, setBusy] = useState<"gerar" | "liberar" | "regenerar" | "sincronizar" | null>(null)
  const [msg, setMsg] = useState("")
  const list = Array.isArray(tracks) ? tracks : []

  // Enquanto gera, sincroniza a cada 12s (consulta o KIE — fallback se o webhook
  // falhar) e recarrega quando ficar pronto.
  useEffect(() => {
    if (status !== "GENERATING") return
    const tick = async () => {
      try {
        const d = await fetch(`/api/admin/producao/${orderId}/suno`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sincronizar" }),
        }).then((r) => r.json())
        if (d.status && d.status !== "GENERATING") window.location.reload()
      } catch { /* ignora */ }
    }
    const t = setInterval(tick, 12000)
    return () => clearInterval(t)
  }, [status, orderId])

  async function gerar() {
    setBusy("gerar"); setMsg("")
    const res = await fetch(`/api/admin/producao/${orderId}/suno`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "gerar" }),
    })
    const d = await res.json()
    setBusy(null)
    if (d.ok) window.location.reload()
    else setMsg(`❌ ${d.error}`)
  }

  async function acao(action: "liberar" | "regenerar" | "sincronizar") {
    setBusy(action); setMsg("")
    const res = await fetch(`/api/admin/producao/${orderId}/suno`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    const d = await res.json()
    if (action === "sincronizar") {
      setBusy(null)
      if (d.status && d.status !== "GENERATING") window.location.reload()
      else setMsg("Ainda gerando — tente de novo em instantes.")
      return
    }
    setBusy(null)
    if (d.ok) window.location.reload()
    else setMsg(`❌ ${d.error}`)
  }

  return (
    <div className="mb-4 rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/[0.05] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-fuchsia-200 font-semibold text-sm flex items-center gap-2">🤖 Música por IA (Suno)</p>
        {status && (
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/15 text-white/60">
            {status === "GENERATING" ? "Gerando…" : status === "READY" ? "Pronta p/ liberar" : status === "RELEASED" ? "Liberada ao cliente" : status === "FAILED" ? "Falhou" : status}
          </span>
        )}
      </div>

      {!status && (
        <div className="flex items-center gap-3">
          <p className="text-white/50 text-xs flex-1">Música ainda não gerada para este pedido.</p>
          <button onClick={gerar} disabled={busy !== null}
            className="text-xs font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
            {busy === "gerar" ? "Gerando…" : "🎵 Gerar agora"}
          </button>
        </div>
      )}

      {status === "GENERATING" && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-fuchsia-300/80 text-xs">
            <span className="w-3 h-3 border-2 border-fuchsia-400 border-t-transparent rounded-full animate-spin" />
            Gerando as versões… atualiza sozinho quando ficar pronto.
          </div>
          <button onClick={() => acao("sincronizar")} disabled={busy !== null}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/15 text-white/60 hover:bg-white/5 disabled:opacity-50">
            {busy === "sincronizar" ? "Verificando…" : "Verificar agora"}
          </button>
        </div>
      )}

      {status === "FAILED" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-red-400 text-xs flex-1">{error ?? "Falha na geração."}</p>
          <button onClick={() => acao("regenerar")} disabled={busy !== null}
            className="text-xs font-semibold px-4 py-2 rounded-lg border border-fuchsia-500/40 text-fuchsia-300 hover:bg-fuchsia-500/10 disabled:opacity-50">
            {busy === "regenerar" ? "Gerando…" : "🔁 Gerar novamente"}
          </button>
        </div>
      )}

      {(status === "READY" || status === "RELEASED") && list.length > 0 && (
        <>
          {status === "RELEASED" && (
            <p className="text-green-400/80 text-xs mb-3">✅ Versões liberadas — o cliente vai escolher a favorita.</p>
          )}
          <div className="space-y-3 mb-3">
            {list.map((t, i) => (
              <div key={t.audioId} className="bg-black/30 border border-white/10 rounded-lg p-3">
                <p className="text-white/70 text-xs mb-1.5">Versão {i + 1}{t.duration ? ` · ${Math.round(t.duration)}s` : ""}</p>
                <audio controls src={t.audioUrl} className="w-full h-9" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {status === "READY" && (
              <button onClick={() => acao("liberar")} disabled={busy !== null}
                className="text-xs font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
                {busy === "liberar" ? "Liberando…" : "✅ Liberar versões para o cliente escolher"}
              </button>
            )}
            <button onClick={() => acao("regenerar")} disabled={busy !== null}
              className="text-xs font-semibold px-4 py-2 rounded-lg border border-fuchsia-500/40 text-fuchsia-300 hover:bg-fuchsia-500/10 disabled:opacity-50">
              {busy === "regenerar" ? "Gerando…" : "🔁 Gerar novamente"}
            </button>
          </div>
        </>
      )}

      {msg && <p className="text-red-400 text-xs mt-2">{msg}</p>}
    </div>
  )
}
