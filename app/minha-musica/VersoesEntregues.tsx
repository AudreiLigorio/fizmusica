"use client"

import { useEffect, useRef, useState } from "react"
import FotosPanel from "./FotosPanel"

type Track = { audioId: string; audioUrl: string; imageUrl: string | null; title: string | null; duration: number | null }

type StepKey = "principal" | "fotos" | "surpresa" | "player"

// Estado entregue com as 2 versões do Suno. A barra de passos vira NAVEGAÇÃO:
// clicar abre o conteúdo do passo logo abaixo (um de cada vez).
// Ordem deliberada: Principal → Fotos → Surpresa → Player — a "surpresa" vem antes
// do player porque é nela que o cliente entende para que serve o QR Code.
export default function VersoesEntregues({
  orderId,
  tracks,
  principalUrl,
  slug,
  photoToken,
  photoCount,
  canRevise,
  onQr,
  onNaoGostei,
  onChanged,
}: {
  orderId: string
  tracks: Track[]
  principalUrl: string | null
  slug: string | null
  photoToken?: string | null
  photoCount?: number
  canRevise?: boolean
  onQr: () => void
  onNaoGostei?: () => void
  onChanged?: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [active, setActive] = useState<StepKey>("principal")
  const [verOutra, setVerOutra] = useState(false)
  const [copied, setCopied] = useState(false)

  // Ao trocar de aba, traz a barra de passos (e o conteúdo novo) pro topo da
  // tela — sem isso, se a aba anterior era mais alta, o conteúdo novo pode
  // renderizar fora da área visível.
  const rootRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [active])

  const hasPhotos  = (photoCount ?? 0) > 0
  const principal  = tracks.find((t) => principalUrl && t.audioUrl === principalUrl) ?? tracks[0]
  const outras     = tracks.filter((t) => t !== principal)
  const publicUrl  = slug ? `https://fizmusica.com.br/m/${slug}` : ""
  const waUrl      = `https://wa.me/?text=${encodeURIComponent(`Ouça a música que eu fiz pra você 🎵 ${publicUrl}`)}`

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
      setVerOutra(false)
      onChanged?.()
    } catch {
      setError("Algo deu errado. Tente de novo.")
      setBusy(null)
    }
  }

  function copiarLink() {
    if (!publicUrl) return
    navigator.clipboard?.writeText(publicUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const steps: { key: StepKey; icon: string; label: string; done: boolean; nudge?: boolean }[] = [
    { key: "principal", icon: "⭐", label: "Principal", done: true },
    { key: "fotos",     icon: "📸", label: "Fotos",     done: hasPhotos, nudge: !hasPhotos },
    { key: "surpresa",  icon: "🎁", label: "Surpresa",  done: false },
    { key: "player",    icon: "▶",  label: "Player",    done: false },
  ]

  const principalIndex = tracks.indexOf(principal)

  return (
    <div ref={rootRef} className="space-y-3">
      {/* Barra de passos — navegação "o que fazer agora" */}
      <div className="grid grid-cols-4 gap-1.5">
        {steps.map((s) => {
          const isActive = active === s.key
          return (
            <button key={s.key} onClick={() => setActive(s.key)}
              className={`relative flex flex-col items-center justify-center rounded-xl py-2.5 px-1 border transition-colors ${
                isActive
                  ? "border-pink-500 bg-pink-500/15"
                  : s.done
                    ? "border-green-500/30 bg-green-500/10 hover:bg-green-500/15"
                    : s.nudge
                      ? "border-pink-500/50 bg-pink-500/[0.07] hover:bg-pink-500/10"
                      : "border-white/10 bg-black/20 hover:bg-white/5"
              }`}>
              {s.nudge && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-semibold bg-pink-500 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  falta isso
                </span>
              )}
              <span className="text-base leading-none mb-1">{s.done && !isActive ? "✓" : s.icon}</span>
              <span className={`text-[10px] font-medium leading-tight ${
                isActive ? "text-pink-100" : s.nudge ? "text-pink-200" : s.done ? "text-green-300" : "text-white/70"
              }`}>{s.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── PRINCIPAL ── só a versão escolhida; "ouvir a outra" revela pra trocar */}
      {active === "principal" && (
        <div className="space-y-3">
          <p className="text-white/60 text-xs">Ouça as versões e escolha a <strong className="text-white/80">principal</strong> — é ela que vai no QR Code e no link. {canRevise ? "Se nenhuma te agradou, você pode pedir para refazer." : "Você pode trocar quando quiser."}</p>

          <div className="rounded-xl border border-pink-500/40 bg-pink-500/[0.06] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/80 text-sm font-medium">
                Versão {principalIndex + 1}{principal.duration ? ` · ${Math.round(principal.duration)}s` : ""}
              </p>
              <span className="text-[10px] font-bold bg-pink-500 text-white px-2 py-0.5 rounded-full">⭐ PRINCIPAL</span>
            </div>
            <audio controls src={principal.audioUrl} className="w-full h-10" />
          </div>

          {outras.length > 0 && !verOutra && (
            <button onClick={() => setVerOutra(true)}
              className="w-full text-center py-2 rounded-lg text-xs text-white/50 hover:text-white/80 border border-white/10 hover:bg-white/5 transition-colors">
              Ouvir / trocar a versão principal ▾
            </button>
          )}

          {verOutra && outras.map((t) => (
            <div key={t.audioId} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/80 text-sm font-medium">
                  Versão {tracks.indexOf(t) + 1}{t.duration ? ` · ${Math.round(t.duration)}s` : ""}
                </p>
                <button onClick={() => tornarPrincipal(t.audioId)} disabled={busy !== null}
                  className="text-[11px] font-semibold border border-pink-500/30 text-pink-300 hover:bg-pink-500/10 disabled:opacity-50 px-2.5 py-1 rounded-lg transition-colors">
                  {busy === t.audioId ? "Trocando…" : "⭐ Tornar principal"}
                </button>
              </div>
              <audio controls src={t.audioUrl} className="w-full h-10" />
            </div>
          ))}

          {/* Saída de emergência: não gostou de nenhuma → pedir revisão. Discreto,
              separado, e só enquanto a revisão está disponível. */}
          {canRevise && onNaoGostei && (
            <div className="border-t border-white/[0.08] pt-3 mt-1">
              <button onClick={onNaoGostei}
                className="w-full text-center py-2.5 rounded-lg text-xs font-medium border border-white/12 text-white/45 hover:border-red-500/30 hover:text-red-400 transition-colors">
                Não gostei de nenhuma — pedir para refazer →
              </button>
              <p className="text-center text-[10px] text-white/30 mt-1.5">Você tem 1 revisão inclusa</p>
            </div>
          )}
        </div>
      )}

      {/* ── FOTOS ── embutidas; o player reflete na hora */}
      {active === "fotos" && (
        photoToken
          ? <FotosPanel token={photoToken} onChange={onChanged} />
          : <p className="text-white/50 text-xs px-1 py-4 text-center">As fotos desta música não estão disponíveis para edição.</p>
      )}

      {/* ── SURPRESA ── opcional: transformar a música em presente físico via QR */}
      {active === "surpresa" && (
        <div className="rounded-xl border border-pink-500/30 bg-pink-500/[0.06] p-4">
          <p className="text-white/55 text-xs text-center mb-3 leading-relaxed">Opcional — surpreenda colando o QR num presente físico: uma caixa, um cartão, um quadro, um buquê ou uma lembrancinha.</p>
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
      )}

      {/* ── PLAYER ── ouvir, baixar e compartilhar */}
      {active === "player" && (
        <div className="space-y-2">
          <p className="text-white/55 text-xs text-center mb-1 leading-relaxed">Veja como ficou no player, com as suas fotos e a música exclusiva. Aqui você pode compartilhar o acesso a esse player exclusivo.</p>
          {slug && (
            <a href={`/m/${slug}`}
              className="block text-center py-3 rounded-lg text-sm font-bold text-white transition-all hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
              ▶ Ouvir no player
            </a>
          )}
          <div className="grid grid-cols-3 gap-2">
            {principalUrl && (
              <a href={`/api/orders/${orderId}/musica/download`} download
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-[11px] font-semibold border border-white/15 text-white/75 hover:bg-white/5 transition-colors">
                <span className="text-base leading-none">⬇</span> Baixar
              </a>
            )}
            <button onClick={copiarLink}
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-[11px] font-semibold border border-white/15 text-white/75 hover:bg-white/5 transition-colors">
              <span className="text-base leading-none">🔗</span> {copied ? "Copiado!" : "Copiar link"}
            </button>
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-[11px] font-semibold border border-green-500/30 text-green-300 hover:bg-green-500/10 transition-colors">
              <span className="text-base leading-none">💬</span> WhatsApp
            </a>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
