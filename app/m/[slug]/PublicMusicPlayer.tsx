"use client"

import { useRef, useState, useEffect } from "react"
import { QRCodeSVG } from "qrcode.react"
import PhotoCarousel from "./PhotoCarousel"

type EffectName = "slide" | "fade" | "cards" | "coverflow"

type MusicData = {
  musicName: string | null
  personName: string | null
  lyrics: string | null
  lyricsLrc: string | null
  mp3Url: string
  imageUrl: string | null
  photos?: string[]
  photoEffect?: EffectName
  order: { nome: string; context: string; subcategory: string; musicalStyle: string } | null
}

type LrcLine = { time: number; text: string }

function parseLrc(lrc: string): LrcLine[] {
  const result: LrcLine[] = []
  for (const raw of lrc.split("\n")) {
    const line = raw.trim()
    const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{1,3})\](.*)$/)
    if (!match) continue
    const minutes = parseInt(match[1])
    const seconds = parseInt(match[2])
    const ms      = parseInt(match[3].padEnd(3, "0"))
    result.push({ time: minutes * 60 + seconds + ms / 1000, text: match[4].trim() })
  }
  return result.sort((a, b) => a.time - b.time).filter((l) => l.text && !/^\[.*\]$/.test(l.text))
}

/* Fundo animado com as cores da identidade — blobs lentos rosa/roxo/fúcsia */
function AnimatedBg() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" style={{ background: "#07060d" }} aria-hidden>
      <style>{`@keyframes fizb1{0%,100%{transform:translate(-8%,-6%) scale(1)}50%{transform:translate(12%,8%) scale(1.25)}}@keyframes fizb2{0%,100%{transform:translate(10%,18%) scale(1.1)}50%{transform:translate(-6%,-8%) scale(1)}}@keyframes fizb3{0%,100%{transform:translate(-4%,28%) scale(1)}50%{transform:translate(16%,2%) scale(1.2)}}`}</style>
      <div style={{ position: "absolute", top: "-12%", left: "-12%", width: "72%", height: "72%", borderRadius: "50%", background: "radial-gradient(circle, rgba(240,25,107,0.60), transparent 70%)", filter: "blur(70px)", animation: "fizb1 20s ease-in-out infinite" }} />
      <div style={{ position: "absolute", bottom: "-18%", right: "-10%", width: "78%", height: "78%", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.55), transparent 70%)", filter: "blur(80px)", animation: "fizb2 26s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: "28%", left: "18%", width: "58%", height: "58%", borderRadius: "50%", background: "radial-gradient(circle, rgba(217,70,239,0.45), transparent 70%)", filter: "blur(90px)", animation: "fizb3 30s ease-in-out infinite" }} />
    </div>
  )
}

/* Equalizador animado (o "efeito de som") — dança quando toca, congela ao pausar */
function Equalizer({ playing, size = 22 }: { playing: boolean; size?: number }) {
  const bars = [0, 1, 2, 3, 4]
  return (
    <div className="flex items-end gap-[3px]" style={{ height: size }} aria-hidden>
      <style>{`@keyframes fizeq{0%{transform:scaleY(0.25)}50%{transform:scaleY(1)}100%{transform:scaleY(0.35)}}`}</style>
      {bars.map((i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: "100%",
            borderRadius: 2,
            transformOrigin: "bottom",
            background: i % 2 ? "#e879f9" : "#f0196b",
            animation: `fizeq ${0.7 + i * 0.13}s ease-in-out infinite alternate`,
            animationPlayState: playing ? "running" : "paused",
            opacity: playing ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  )
}

export default function PublicMusicPlayer({
  music,
  publicUrl,
}: {
  music: MusicData
  publicUrl: string
}) {
  const audioRef          = useRef<HTMLAudioElement>(null)
  const lyricsRef         = useRef<HTMLDivElement>(null)
  const activeLineRef     = useRef<HTMLParagraphElement>(null)
  const [playing, setPlaying]       = useState(false)
  const [progress, setProgress]     = useState(0)
  const [duration, setDuration]     = useState(0)
  const [copied, setCopied]         = useState(false)
  const [showQr, setShowQr]         = useState(false)
  const [activeLine, setActiveLine] = useState(0)
  const [sheetOpen, setSheetOpen]   = useState(false)
  const sheetTouchY = useRef<number | null>(null)

  const lrcLines: LrcLine[] | null = music.lyricsLrc ? parseLrc(music.lyricsLrc) : null
  const plainLines = (music.lyrics ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^\[.*\]$/.test(l))
  const lines = lrcLines ? lrcLines.map((l) => l.text) : plainLines

  const photos = music.photos ?? []
  const effect = music.photoEffect ?? "slide"

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause() } else { audio.play() }
    setPlaying(!playing)
  }

  function handleTimeUpdate() {
    const audio = audioRef.current
    if (!audio) return
    const t = audio.currentTime
    const d = audio.duration || 0
    setProgress(t)
    setDuration(d)
    if (lrcLines && lrcLines.length > 0) {
      let idx = 0
      for (let i = 0; i < lrcLines.length; i++) {
        if (t >= lrcLines[i].time) idx = i
        else break
      }
      setActiveLine(idx)
    } else if (plainLines.length > 0 && d > 0) {
      setActiveLine(Math.min(Math.floor((t / d) * plainLines.length), plainLines.length - 1))
    }
  }

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [activeLine])

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Number(e.target.value)
    setProgress(Number(e.target.value))
  }

  function formatTime(s: number) {
    if (!s || isNaN(s)) return "0:00"
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /* ───────────────────── blocos reutilizáveis ───────────────────── */

  const titleBlock = (
    <div className="text-center">
      {music.personName && <p className="text-gray-300 text-sm mb-1">Uma música especial para</p>}
      <h1 className="text-3xl md:text-4xl font-bold leading-tight">
        {music.personName ? (
          <span className="bg-gradient-to-r from-pink-400 to-fuchsia-500 bg-clip-text text-transparent">
            {music.personName}
          </span>
        ) : (
          music.musicName ?? "Sua música"
        )}
      </h1>
      {music.musicName && music.personName && (
        <p className="text-gray-300 mt-1 text-sm italic">"{music.musicName}"</p>
      )}
    </div>
  )

  const lyricsBlock = lines.length > 0 && (
    <div
      ref={lyricsRef}
      className="overflow-y-auto px-2 w-full"
      style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)" }}
    >
      <div className="flex flex-col gap-3 py-6">
        {lines.map((line, i) => {
          const isActive = i === activeLine
          const isNear = Math.abs(i - activeLine) <= 1
          return (
            <p
              key={i}
              ref={isActive ? activeLineRef : undefined}
              className="text-center leading-snug transition-all duration-500 select-none"
              style={{
                fontSize: isActive ? "1.2rem" : isNear ? "1rem" : "0.875rem",
                fontWeight: isActive ? 700 : isNear ? 500 : 400,
                color: isActive ? "#fff" : isNear ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)",
                textShadow: isActive ? "0 0 20px rgba(236,72,153,0.6)" : "none",
              }}
            >
              {line}
            </p>
          )
        })}
      </div>
    </div>
  )

  const progressBar = (
    <div className="w-full">
      <input
        type="range" min={0} max={duration || 0} step={0.1} value={progress}
        onChange={handleSeek}
        className="w-full accent-pink-500 cursor-pointer h-1"
      />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{formatTime(progress)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )

  const playButton = (
    <button
      onClick={togglePlay}
      className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95 shrink-0"
      aria-label={playing ? "Pausar" : "Tocar"}
    >
      {playing ? (
        <svg className="w-7 h-7 text-black" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : (
        <svg className="w-7 h-7 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  )

  const shareButtons = (
    <div className="w-full space-y-3">
      <p className="text-center text-gray-400 text-xs mb-1">Compartilhe esta música ❤️</p>
      <div className="flex gap-3">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 bg-white/10 border border-white/15 hover:bg-white/15 transition-all py-3 rounded-2xl text-sm font-medium"
        >
          {copied ? "✅ Copiado!" : "🔗 Copiar link"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Ouça a música especial que criei para você: ${publicUrl}`)}`}
          target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all py-3 rounded-2xl text-sm font-medium text-green-400"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          WhatsApp
        </a>
      </div>
      <button
        onClick={() => setShowQr(true)}
        className="w-full flex items-center justify-center gap-2 bg-white/10 border border-white/15 hover:bg-white/15 transition-all py-3 rounded-2xl text-sm font-medium"
      >
        📱 Imprimir QR Code
      </button>
    </div>
  )

  const photoPanel =
    photos.length > 0 ? (
      <PhotoCarousel photos={photos} effect={effect} />
    ) : music.imageUrl ? (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={music.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
    ) : (
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-black to-zinc-900" />
    )

  /* swipe no bottom sheet (mobile) */
  function onSheetTouchStart(e: React.TouchEvent) { sheetTouchY.current = e.touches[0].clientY }
  function onSheetTouchEnd(e: React.TouchEvent) {
    if (sheetTouchY.current === null) return
    const dy = e.changedTouches[0].clientY - sheetTouchY.current
    if (dy < -30) setSheetOpen(true)
    else if (dy > 30) setSheetOpen(false)
    sheetTouchY.current = null
  }

  return (
    <div className="relative min-h-[100dvh] bg-[#07060d] text-white overflow-hidden">
      <AnimatedBg />

      <audio
        ref={audioRef}
        src={music.mp3Url || undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={() => setPlaying(false)}
      />

      {/* ===================== DESKTOP — split screen ===================== */}
      <div className="hidden lg:grid lg:grid-cols-[42%_58%] h-[100dvh]">
        {/* Painel esquerdo — controles */}
        <div className="relative z-10 flex flex-col px-10 py-8 min-h-0">
          <div className="shrink-0">{titleBlock}</div>
          <div className="flex-1 min-h-0 flex flex-col justify-center my-3">{lyricsBlock}</div>
          <div className="shrink-0 space-y-4 max-w-md mx-auto w-full">
            {progressBar}
            <div className="flex items-center justify-center gap-5">
              {playButton}
              <Equalizer playing={playing} size={26} />
            </div>
            {shareButtons}
            <div className="flex items-center justify-center gap-3 pt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_fizmusica.png" alt="FizMusica" className="h-6 opacity-70" />
              <a href="/" className="bg-pink-500 hover:bg-pink-600 transition-all px-4 py-2 rounded-xl text-xs font-semibold text-white">
                🎵 Criar minha música
              </a>
            </div>
          </div>
        </div>

        {/* Painel direito — fotos */}
        <div className="relative bg-black">
          {photoPanel}
          <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: "linear-gradient(90deg, rgba(7,6,13,0.85) 0%, transparent 22%)" }} />
        </div>
      </div>

      {/* ===================== MOBILE — imersivo + bottom sheet ===================== */}
      <div className="lg:hidden relative min-h-[100dvh]">
        <div className="absolute inset-0 z-0">{photoPanel}</div>
        <div className="absolute inset-0 z-[5] pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 30%, transparent 45%, rgba(0,0,0,0.85) 100%)" }} />

        {/* Topo — nome */}
        <div className="relative z-10 pt-10 px-6">{titleBlock}</div>

        {/* Bottom sheet */}
        <div
          className="absolute left-0 right-0 bottom-0 z-20 h-[84vh] rounded-t-3xl border-t border-white/10 transition-transform duration-300 ease-out flex flex-col"
          style={{
            background: "linear-gradient(180deg, rgba(20,10,28,0.86) 0%, rgba(10,9,18,0.96) 40%)",
            backdropFilter: "blur(18px)",
            transform: sheetOpen ? "translateY(0)" : "translateY(calc(100% - 168px))",
          }}
          onTouchStart={onSheetTouchStart}
          onTouchEnd={onSheetTouchEnd}
        >
          {/* Puxador */}
          <button onClick={() => setSheetOpen((v) => !v)} className="w-full pt-3 pb-1 flex flex-col items-center shrink-0">
            <span className="w-10 h-1.5 rounded-full bg-white/40" />
            <span className="text-[11px] text-white/50 mt-1.5">{sheetOpen ? "arraste para baixo" : "arraste para cima"}</span>
          </button>

          {/* Linha recolhida — play + título + equalizador */}
          <div className="shrink-0 flex items-center gap-3 px-6 py-2">
            {playButton}
            <div className="min-w-0 flex-1">
              <p className="font-bold truncate">{music.personName ?? music.musicName ?? "Sua música"}</p>
              {music.musicName && music.personName && (
                <p className="text-xs text-gray-400 italic truncate">"{music.musicName}"</p>
              )}
            </div>
            <Equalizer playing={playing} size={22} />
          </div>

          {/* Conteúdo expandido */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-8 pt-2 flex flex-col gap-5">
            {progressBar}
            <div className="flex-1 min-h-0">{lyricsBlock}</div>
            {shareButtons}
            <div className="flex items-center justify-center gap-4 pt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_fizmusica.png" alt="FizMusica" className="h-7 opacity-80" />
              <a href="/" className="bg-pink-500 hover:bg-pink-600 transition-all px-5 py-2.5 rounded-2xl text-sm font-semibold text-white">
                🎵 Criar minha música
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== MODAL QR (impressão) ===================== */}
      {showQr && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 print:p-0 print:bg-white print:inset-auto">
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <div
              id="qr-print-card"
              className="relative w-full bg-[#FBF5EE] rounded-2xl border-2 border-dashed border-[#C8B99A]/50 flex flex-col items-center justify-between py-10 px-8 print:rounded-none print:border-none print:shadow-none"
              style={{ minHeight: 520 }}
            >
              <div className="flex flex-col items-center gap-5">
                <div className="flex items-center gap-3">
                  <span className="block h-px w-8 bg-[#B8963E]" /><span className="text-[#B8963E] text-xl">♥</span><span className="block h-px w-8 bg-[#B8963E]" />
                </div>
                <p className="text-[#2C2216] text-center font-serif leading-snug" style={{ fontSize: "1.6rem" }}>
                  Existe algo que<br />eu gostaria de<br />te dizer.
                </p>
                <div className="flex items-center gap-3">
                  <span className="block h-px w-8 bg-[#B8963E]" /><span className="text-[#B8963E] text-xl">♥</span><span className="block h-px w-8 bg-[#B8963E]" />
                </div>
                <p className="text-[#B8963E] italic text-lg font-serif">Escaneie e descubra.</p>
              </div>
              <div className="my-6 border-2 border-[#C8B99A] rounded-xl p-5 bg-white flex items-center justify-center">
                <QRCodeSVG value={publicUrl} size={160} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8963E" strokeWidth="1.5">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <p className="text-[#2C2216] tracking-[0.2em] text-xs font-semibold mt-1">FIZMÚSICA</p>
                <p className="text-[#9A8A76] tracking-widest text-[10px]">SUA HISTÓRIA. SUA MÚSICA.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const qrSvg = document.getElementById("qr-print-card")?.querySelector("svg")?.outerHTML ?? ""
                  const win = window.open("", "_blank", "width=480,height=720")
                  if (!win) return
                  win.document.write(`<!DOCTYPE html><html><head>
                  <meta charset="utf-8">
                  <title>QR Code - FizMúsica</title>
                  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
                  <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    @media print { body { margin: 0; } }
                    body { background: #EDE0D4; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: 'EB Garamond', Georgia, serif; }
                    .card { background: #FBF5EE; border-radius: 18px; border: 2px dashed #C8B99A; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 44px 40px; width: 360px; min-height: 500px; gap: 8px; }
                    .sep { display: flex; align-items: center; gap: 10px; color: #B8963E; }
                    .sep-line { display: block; height: 1px; width: 30px; background: #B8963E; }
                    .heart { font-size: 16px; }
                    .title { color: #2C2216; font-size: 30px; text-align: center; line-height: 1.35; margin: 4px 0; }
                    .subtitle { color: #B8963E; font-style: italic; font-size: 20px; margin: 4px 0 8px; }
                    .qr-box { border: 2px solid #C8B99A; border-radius: 12px; padding: 18px; background: #fff; display: flex; align-items: center; justify-content: center; }
                    .footer { display: flex; flex-direction: column; align-items: center; gap: 3px; margin-top: 4px; }
                    .heart-outline { font-size: 20px; color: transparent; -webkit-text-stroke: 1.5px #B8963E; }
                    .brand { color: #2C2216; letter-spacing: .2em; font-size: 11px; font-family: sans-serif; font-weight: 700; }
                    .tagline { color: #9A8A76; letter-spacing: .12em; font-size: 9px; font-family: sans-serif; }
                  </style></head><body>
                  <div class="card">
                    <div class="sep"><span class="sep-line"></span><span class="heart">♥</span><span class="sep-line"></span></div>
                    <p class="title">Existe algo que<br>eu gostaria de<br>te dizer.</p>
                    <div class="sep"><span class="sep-line"></span><span class="heart">♥</span><span class="sep-line"></span></div>
                    <p class="subtitle">Escaneie e descubra.</p>
                    <div class="qr-box">${qrSvg}</div>
                    <div class="footer">
                      <span class="heart-outline">♡</span>
                      <p class="brand">FIZMÚSICA</p>
                      <p class="tagline">SUA HISTÓRIA. SUA MÚSICA.</p>
                    </div>
                  </div>
                  <script>window.onload=()=>{ setTimeout(()=>{ window.print(); window.close() }, 800) }<\/script>
                  </body></html>`)
                  win.document.close()
                }}
                className="flex items-center gap-2 bg-[#B8963E] hover:bg-[#9A7D35] text-white px-6 py-3 rounded-2xl text-sm font-semibold transition-all"
              >
                🖨️ Imprimir
              </button>
              <button
                onClick={() => setShowQr(false)}
                className="flex items-center gap-2 bg-white/10 border border-white/20 hover:bg-white/20 text-white px-5 py-3 rounded-2xl text-sm transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
