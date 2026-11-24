"use client"

import { useEffect, useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"

// "+ Ver como fica": mostra, ANTES de pagar, o que o plano entrega de fato —
// a mesma música de exemplo (Meu Melhor Talento, pedido de demonstração da
// Pâmela, já usado no onboarding e no anúncio) montada conforme os AJUSTES do
// plano no admin: sem fotos fica a capa; com fotos, as fotos passam no lugar
// dela; QR Code mostra o cartão. Mudou o plano no admin, a prévia muda junto.
//
// Fica escura sempre (data-zona-escura): é o player, e os players do site são
// escuros nos dois temas.

export type PlanoPrevia = {
  id: string
  name: string
  photo_limit?: number | null
  feat_lyrics_sync?: boolean | null
  feat_qrcode?: boolean | null
  feat_revision?: boolean | null
  category?: string | null
}

const AUDIO = "/onboarding/talento.mp3"
const CAPA = "/onboarding/capa-talento.jpg"
const FOTOS = [1, 2, 3, 4].map((i) => `/onboarding/casal-${i}.jpg`)
// Tempos (s) do trecho talento.mp3 — os mesmos do onboarding (motor.js).
const LETRA = [
  { t: 0, l: "O meu porto seguro, minha felicidade" },
  { t: 2.3, l: "Eu sei que sou meio atrapalhado, é verdade" },
  { t: 6.46, l: "Não consigo fazer duas coisas ao mesmo tempo" },
  { t: 10.37, l: "Mas focar em você é o meu melhor talento" },
]

export default function VerComoFica({
  plano,
  selecionado,
  onEscolher,
  onFechar,
}: {
  plano: PlanoPrevia
  selecionado: boolean
  onEscolher: () => void
  onFechar: () => void
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [tocando, setTocando] = useState(false)
  const [tempo, setTempo] = useState(0)
  const [dur, setDur] = useState(13.4)
  const [foto, setFoto] = useState(0)

  const fotos = plano.photo_limit ?? 0
  const temFotos = fotos > 0
  const sincronizada = !!plano.feat_lyrics_sync

  // O toque que abriu a janela conta como gesto do usuário: o som pode
  // começar sozinho. Se o navegador recusar, o botão de play resolve.
  useEffect(() => {
    const a = new Audio(AUDIO)
    a.loop = true
    audioRef.current = a
    const onTime = () => setTempo(a.currentTime)
    const onMeta = () => { if (a.duration && isFinite(a.duration)) setDur(a.duration) }
    const onPlay = () => setTocando(true)
    const onPause = () => setTocando(false)
    a.addEventListener("timeupdate", onTime)
    a.addEventListener("loadedmetadata", onMeta)
    a.addEventListener("play", onPlay)
    a.addEventListener("pause", onPause)
    a.play().catch(() => {})
    return () => {
      a.pause()
      a.removeEventListener("timeupdate", onTime)
      a.removeEventListener("loadedmetadata", onMeta)
      a.removeEventListener("play", onPlay)
      a.removeEventListener("pause", onPause)
      audioRef.current = null
    }
  }, [])

  // Fotos passando, como no player da Retrospectiva.
  useEffect(() => {
    if (!temFotos) return
    const t = setInterval(() => setFoto((f) => (f + 1) % FOTOS.length), 3300)
    return () => clearInterval(t)
  }, [temFotos])

  // Esc fecha; a página atrás não rola enquanto a janela está aberta.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar() }
    window.addEventListener("keydown", onKey)
    const antes = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = antes }
  }, [onFechar])

  const linhaAtual = LETRA.reduce((acc, x, i) => (tempo >= x.t ? i : acc), 0)

  function alternar() {
    const a = audioRef.current
    if (!a) return
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  }

  const itens: string[] = []
  itens.push(temFotos ? `Até ${fotos} fotos de vocês passando com a música` : "Sem fotos: a capa fica no lugar")
  if (plano.feat_qrcode) itens.push("Cartão com QR Code pra entregar")
  if (plano.feat_revision) itens.push("Ajustes inclusos")
  if (plano.category === "DIGITAL_PHYSICAL") itens.push("Caixa física com frete grátis")

  return (
    <div
      data-zona-escura
      className="fixed inset-0 z-[80] flex items-end lg:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={`Como fica o plano ${plano.name}`}
    >
      <style>{`
        @keyframes vcf-zoom { from { transform: scale(1) } to { transform: scale(1.08) } }
        @keyframes vcf-sobe { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }
      `}</style>
      <div
        className="w-full lg:max-w-[400px] max-h-[92dvh] overflow-y-auto rounded-t-[24px] lg:rounded-[24px] px-5 pt-3 pb-6 text-white"
        style={{ background: "#120c18", border: "1px solid rgba(255,255,255,0.1)", animation: "vcf-sobe .25s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-3 lg:hidden" style={{ background: "rgba(255,255,255,0.2)" }} />
        <div className="flex items-center justify-between mb-3">
          <p className="text-[17px] font-semibold">Como fica o plano {plano.name}</p>
          <button onClick={onFechar} aria-label="Fechar" className="w-9 h-9 -mr-2 flex items-center justify-center text-white/60 text-xl">✕</button>
        </div>

        {/* Visual: capa (sem fotos) ou fotos passando (com fotos) */}
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-3" style={{ background: "#000" }}>
          {temFotos ? (
            FOTOS.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={i === foto ? "Foto de exemplo passando no player" : ""}
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                style={{ opacity: i === foto ? 1 : 0, animation: i === foto ? "vcf-zoom 3.4s linear both" : undefined }}
              />
            ))
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={CAPA} alt="Capa exclusiva de exemplo" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute left-0 right-0 bottom-0 px-3 pb-2.5 pt-10 flex items-center gap-2.5"
               style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))" }}>
            {temFotos && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={CAPA} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">Meu Melhor Talento</p>
              <p className="text-[12px] text-white/70 leading-tight">Feita para a Pâmela</p>
            </div>
          </div>
        </div>

        {/* Letra */}
        <div className="mb-3 min-h-[104px]">
          {LETRA.map((x, i) => (
            <p key={x.t}
               className="text-[15px] leading-snug py-0.5 transition-colors duration-300"
               style={{
                 color: !sincronizada ? "rgba(255,255,255,0.85)" : i === linhaAtual ? "#ffffff" : "rgba(255,255,255,0.35)",
                 fontWeight: sincronizada && i === linhaAtual ? 700 : 500,
               }}>
              {x.l}
            </p>
          ))}
          {sincronizada && <p className="text-[12px] text-white/45 mt-1">A letra acende junto com a música.</p>}
        </div>

        {/* Controle */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={alternar} aria-label={tocando ? "Pausar" : "Tocar"}
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white"
                  style={{ background: "#f0196b" }}>
            {tocando ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            ) : (
              <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>
            )}
          </button>
          <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
            <div className="h-1 rounded-full" style={{ width: `${Math.min(100, (tempo / dur) * 100)}%`, background: "#f0196b" }} />
          </div>
        </div>

        {plano.feat_qrcode && (
          <div className="flex items-center gap-3 rounded-2xl p-3 mb-4" style={{ background: "#fff" }}>
            <QRCodeSVG value="https://fizmusica.com.br" size={64} />
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: "#1a1020" }}>Cartão com QR Code</p>
              <p className="text-[13px] leading-snug" style={{ color: "#4a4351" }}>Pra entregar junto com o presente: aponta a câmera e a música toca.</p>
            </div>
          </div>
        )}

        <ul className="space-y-1 mb-5">
          {itens.map((t) => (
            <li key={t} className="flex gap-2 text-sm" style={{ color: temFotos || !t.startsWith("Sem") ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.6)" }}>
              <span aria-hidden="true" style={{ color: t.startsWith("Sem") ? "rgba(255,255,255,0.6)" : "#4ade80" }}>{t.startsWith("Sem") ? "✕" : "✓"}</span>
              <span className={t.startsWith("Sem") ? "font-semibold" : ""}>{t}</span>
            </li>
          ))}
        </ul>

        {/* Botão preso no pé da janela: em celular pequeno a janela rola,
            e o "Quero este plano" não pode sumir lá embaixo. */}
        <div className="sticky -bottom-6 -mx-5 px-5 pt-3 pb-6 -mb-6" style={{ background: "#120c18" }}>
          <button
            onClick={() => { onEscolher(); onFechar() }}
            className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white"
            style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)" }}
          >
            {selecionado ? "Continuar com este plano" : "Quero este plano"}
          </button>
          <p className="text-[12px] text-white/40 text-center mt-2">Exemplo com a música de outra pessoa. A sua é feita com a sua história.</p>
        </div>
      </div>
    </div>
  )
}
