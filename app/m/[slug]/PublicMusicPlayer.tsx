"use client"

import { useRef, useState, useEffect } from "react"
import { QRCodeSVG } from "qrcode.react"

type MusicData = {
  musicName: string | null
  personName: string | null
  lyrics: string | null
  lyricsLrc: string | null
  mp3Url: string
  imageUrl: string | null
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
  // filtra linhas vazias e marcadores de seção como [Verse 1], [Chorus], etc.
  return result.sort((a, b) => a.time - b.time).filter((l) => l.text && !/^\[.*\]$/.test(l.text))
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

  // LRC tem prioridade; fallback para letra simples distribuída proporcionalmente
  const lrcLines: LrcLine[] | null = music.lyricsLrc ? parseLrc(music.lyricsLrc) : null
  const plainLines = (music.lyrics ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^\[.*\]$/.test(l))
  const lines = lrcLines ? lrcLines.map((l) => l.text) : plainLines

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

  return (
    <div className="relative h-[100dvh] flex flex-col overflow-hidden bg-black text-white">

      {/* BACKGROUND — foto em tela cheia com overlay */}
      {music.imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={music.imageUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* overlay gradiente: escurece topo e base, preserva a foto no meio */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/85" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-black to-zinc-900" />
      )}

      {/* CONTEÚDO */}
      <div className="relative z-10 flex flex-col h-full overflow-y-auto">

        {/* TOPO — badge + destinatário + título */}
        <div className="pt-10 px-6 text-center shrink-0">
          {music.personName && (
            <p className="text-gray-300 text-sm mb-1">Uma música especial para</p>
          )}
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

        {/* espaço que deixa a foto do fundo aparecer */}
        <div className="flex-1" />

        {/* AUDIO */}
        <audio
          ref={audioRef}
          src={music.mp3Url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onEnded={() => setPlaying(false)}
        />

        {/* PROGRESSO */}
        <div className="shrink-0 px-6 pt-4 max-w-lg mx-auto w-full">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={progress}
            onChange={handleSeek}
            className="w-full accent-pink-500 cursor-pointer h-1"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* BOTÃO PLAY */}
        <div className="shrink-0 flex justify-center py-4">
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95"
          >
            {playing ? (
              <svg className="w-7 h-7 text-black" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* LETRA — scroll interno com animação */}
        {lines.length > 0 && (
          <div
            ref={lyricsRef}
            className="shrink-0 overflow-y-auto px-6 max-w-lg mx-auto w-full"
            style={{
              maxHeight: "28vh",
              maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
            }}
          >
            <div className="flex flex-col gap-4 py-8">
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
                      color: isActive
                        ? "#fff"
                        : isNear
                        ? "rgba(255,255,255,0.5)"
                        : "rgba(255,255,255,0.25)",
                      textShadow: isActive ? "0 0 20px rgba(236,72,153,0.6)" : "none",
                    }}
                  >
                    {line}
                  </p>
                )
              })}
            </div>
          </div>
        )}

        {/* COMPARTILHAR */}
        <div className="shrink-0 px-6 pt-4 pb-6 max-w-lg mx-auto w-full space-y-3">
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
              target="_blank"
              rel="noopener noreferrer"
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

          {showQr && (
            <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl">
              <QRCodeSVG value={publicUrl} size={180} />
              <p className="text-gray-500 text-xs text-center">Escaneie para ouvir a música</p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="shrink-0 pb-8 flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_fizmusica.png" alt="FizMusica" className="h-8 opacity-80" />
          <a
            href="/"
            className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 transition-all px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg shadow-pink-500/30"
          >
            🎵 Criar minha música
          </a>
        </div>
      </div>
    </div>
  )
}
