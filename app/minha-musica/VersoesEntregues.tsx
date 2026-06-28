"use client"

import { useRef, useState } from "react"
import FotosPanel from "./FotosPanel"

type Track = { audioId: string; audioUrl: string; imageUrl: string | null; title: string | null; duration: number | null }

// Estado entregue com as 2 versões do Suno: ambas disponíveis (ouvir/baixar),
// uma marcada como principal (player público + QR). Permite trocar a principal.
//
// A tela é organizada como uma jornada de 4 passos ("o que fazer agora") em vez de
// repetir o status de produção (passado): Principal → Fotos → Player → Surpresa.
// Aprendizado de teste real: cliente baixava o MP3 e achava que tinha acabado,
// passava batido nas fotos e ficava em dúvida de como usar o QR.
export default function VersoesEntregues({
  orderId,
  tracks,
  principalUrl,
  slug,
  photoToken,
  photoCount,
  onQr,
  onChanged,
}: {
  orderId: string
  tracks: Track[]
  principalUrl: string | null
  slug: string | null
  photoToken?: string | null
  photoCount?: number
  onQr: () => void
  onChanged?: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [fotosOpen, setFotosOpen] = useState(false)
  const versoesRef = useRef<HTMLDivElement>(null)
  const fotosRef   = useRef<HTMLDivElement>(null)

  const hasPhotos = (photoCount ?? 0) > 0

  async function tornarPrincipal(audioId: string) {
    setBusy(audioId); setError("")
    try {
      const res = await fetch(`/api/orders/${orderId}/musica/escolher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioId }),
      })
      const d = await res.json()
      if (!d.ok) { setError(d.error ?? "Não consegui trocar a versão principal."); setBusy(null); return }
      onChanged?.()
    } catch {
      setError("Algo deu errado. Tente de novo.")
      setBusy(null)
    }
  }

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  function openFotos() {
    setFotosOpen(true)
    setTimeout(() => scrollTo(fotosRef), 60)
  }

  // Passos da jornada "o que fazer agora". done = já resolvido; action = leva a algo.
  const steps = [
    { key: "principal", icon: "⭐", label: "Principal", done: true,      onClick: () => scrollTo(versoesRef) },
    { key: "fotos",     icon: "📸", label: "Fotos",     done: hasPhotos,  nudge: !hasPhotos, onClick: openFotos },
    { key: "player",    icon: "▶",  label: "Player",    done: false,      href: slug ? `/m/${slug}` : undefined },
    { key: "surpresa",  icon: "🎁", label: "Surpresa",  done: false,      onClick: onQr },
  ]

  return (
    <div className="space-y-3">
      {/* Jornada "o que fazer agora" — substitui o status de produção */}
      <div className="grid grid-cols-4 gap-1.5">
        {steps.map((s) => {
          const inner = (
            <>
              {s.nudge && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-semibold bg-pink-500 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  falta isso
                </span>
              )}
              <span className={`text-base leading-none mb-1 ${s.done ? "" : "opacity-90"}`}>
                {s.done ? "✓" : s.icon}
              </span>
              <span className={`text-[10px] font-medium leading-tight ${s.nudge ? "text-pink-200" : "text-white/70"}`}>
                {s.label}
              </span>
            </>
          )
          const cls = `relative flex flex-col items-center justify-center rounded-xl py-2.5 px-1 border transition-colors ${
            s.done
              ? "border-green-500/30 bg-green-500/10 text-green-300"
              : s.nudge
                ? "border-pink-500/50 bg-pink-500/[0.07]"
                : "border-white/10 bg-black/20 hover:bg-white/5"
          }`
          return s.href ? (
            <a key={s.key} href={s.href} className={cls}>{inner}</a>
          ) : (
            <button key={s.key} onClick={s.onClick} className={cls}>{inner}</button>
          )
        })}
      </div>

      {/* Fotos — embutidas, abrem pelo passo 2 (player reflete na hora) */}
      {fotosOpen && photoToken && (
        <div ref={fotosRef}>
          <FotosPanel token={photoToken} onChange={onChanged} />
        </div>
      )}

      {/* Escolher a versão principal */}
      <div ref={versoesRef} className="space-y-3">
        <p className="text-white/60 text-xs">Escolha qual versão será a <strong className="text-white/80">principal</strong> — é ela que vai no QR Code e no link.</p>

        {tracks.map((t, i) => {
          const isPrincipal = !!principalUrl && t.audioUrl === principalUrl
          return (
            <div key={t.audioId} className={`rounded-xl border p-4 ${isPrincipal ? "border-pink-500/40 bg-pink-500/[0.06]" : "border-white/10 bg-black/20"}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/80 text-sm font-medium">
                  Versão {i + 1}{t.duration ? ` · ${Math.round(t.duration)}s` : ""}
                </p>
                {isPrincipal ? (
                  <span className="text-[10px] font-bold bg-pink-500 text-white px-2 py-0.5 rounded-full">⭐ PRINCIPAL</span>
                ) : (
                  <button onClick={() => tornarPrincipal(t.audioId)} disabled={busy !== null}
                    className="text-[11px] font-semibold border border-pink-500/30 text-pink-300 hover:bg-pink-500/10 disabled:opacity-50 px-2.5 py-1 rounded-lg transition-colors">
                    {busy === t.audioId ? "Trocando…" : "⭐ Tornar principal"}
                  </button>
                )}
              </div>
              <audio controls src={t.audioUrl} className="w-full h-10 mb-2" />
              <div className="flex items-center justify-between gap-2">
                {isPrincipal && slug ? (
                  <a href={`/m/${slug}`}
                    className="flex-1 text-center py-2.5 rounded-lg text-xs font-bold text-white transition-all hover:brightness-110"
                    style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
                    ▶ Ouvir no player
                  </a>
                ) : <span />}
                <a href={t.audioUrl} download className="text-[11px] text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors shrink-0">
                  baixar arquivo
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {/* A surpresa — o QR vira presente (tom festivo da marca, não "aviso") */}
      <div className="rounded-xl border border-pink-500/30 bg-pink-500/[0.06] p-4">
        <p className="text-center text-sm font-semibold text-pink-200 mb-3">Agora a surpresa — o QR vira presente</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: "🖨️", t: "Imprime o QR" },
            { icon: "🎁", t: "Cola no presente" },
            { icon: "❤️", t: "Aponta e ouve" },
          ].map((m, i) => (
            <div key={i} className="text-center">
              <div className="text-xl mb-1">{m.icon}</div>
              <div className="text-[10px] text-white/55 leading-tight">{m.t}</div>
            </div>
          ))}
        </div>
        <button onClick={onQr}
          className="w-full text-center py-3 rounded-lg text-sm font-bold text-white transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
          📱 Imprimir QR e fazer a surpresa
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
