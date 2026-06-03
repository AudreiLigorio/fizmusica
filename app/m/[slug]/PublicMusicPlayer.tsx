"use client"

import { useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"

type MusicData = {
  music_name: string | null
  person_name: string | null
  lyrics: string | null
  mp3_url: string
  image_url: string | null
  orders: { nome: string; context: string; subcategory: string; musicalStyle: string } | null
}

export default function PublicMusicPlayer({
  music,
  publicUrl,
}: {
  music: MusicData
  publicUrl: string
}) {
  const audioRef             = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [copied, setCopied]   = useState(false)
  const [showQr, setShowQr]   = useState(false)

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play()
    }
    setPlaying(!playing)
  }

  function handleTimeUpdate() {
    const audio = audioRef.current
    if (!audio) return
    setProgress(audio.currentTime)
    setDuration(audio.duration || 0)
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Number(e.target.value)
    setProgress(Number(e.target.value))
  }

  function formatTime(s: number) {
    if (!s || isNaN(s)) return "0:00"
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const order = Array.isArray(music.orders) ? music.orders[0] : music.orders

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">

      {/* CABEÇALHO */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 px-4 py-2 rounded-full text-pink-300 text-sm font-medium mb-6">
          <span className="w-2 h-2 bg-pink-500 rounded-full shadow-[0_0_8px_rgba(236,72,153,0.9)]" />
          Feita com amor pela FizMusica ❤️
        </div>

        {music.person_name && (
          <p className="text-gray-200 text-lg mb-2">Uma música especial para</p>
        )}
        <h1 className="text-4xl md:text-5xl font-bold leading-tight">
          {music.person_name ? (
            <span className="bg-gradient-to-r from-pink-400 to-fuchsia-500 bg-clip-text text-transparent">
              {music.person_name}
            </span>
          ) : (
            music.music_name ?? "Sua música"
          )}
        </h1>
        {music.music_name && music.person_name && (
          <p className="text-gray-300 mt-2 text-lg">"{music.music_name}"</p>
        )}
        {order && (
          <p className="text-gray-300 text-sm mt-2">{order.subcategory} · {order.musicalStyle}</p>
        )}
      </div>

      {/* PLAYER */}
      <div className="w-full max-w-lg bg-white/5 border border-white/10 rounded-[32px] p-8 backdrop-blur-xl mb-8">

        {/* Imagem de capa */}
        {music.image_url ? (
          <img
            src={music.image_url}
            alt="Capa da música"
            className="w-40 h-40 rounded-2xl mx-auto mb-6 object-cover shadow-2xl"
          />
        ) : (
          <div className="w-40 h-40 rounded-2xl mx-auto mb-6 bg-gradient-to-br from-pink-500/30 to-fuchsia-500/30 border border-pink-500/20 flex items-center justify-center text-6xl">
            🎵
          </div>
        )}

        {/* Controles */}
        <audio
          ref={audioRef}
          src={music.mp3_url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onEnded={() => setPlaying(false)}
        />

        <button
          onClick={togglePlay}
          className="w-20 h-20 rounded-full bg-pink-500 hover:bg-pink-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-pink-500/30 transition-all hover:scale-105 active:scale-95"
        >
          {playing ? (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Barra de progresso */}
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={progress}
            onChange={handleSeek}
            className="w-full accent-pink-500 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-300">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* LETRA */}
      {music.lyrics && (
        <div className="w-full max-w-lg mb-8">
          <details className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <summary className="p-5 cursor-pointer text-gray-300 font-medium hover:text-white select-none">
              📝 Ver a letra
            </summary>
            <div className="px-6 pb-6 whitespace-pre-wrap text-gray-300 leading-relaxed text-sm border-t border-white/5 pt-4">
              {music.lyrics}
            </div>
          </details>
        </div>
      )}

      {/* COMPARTILHAR */}
      <div className="w-full max-w-lg space-y-3">
        <p className="text-center text-gray-300 text-sm mb-4">Compartilhe esta música ❤️</p>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 transition-all py-3 rounded-2xl text-sm font-medium"
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

        {/* QR Code */}
        <button
          onClick={() => setShowQr(!showQr)}
          className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 transition-all py-3 rounded-2xl text-sm font-medium"
        >
          📱 {showQr ? "Ocultar" : "Ver"} QR Code
        </button>

        {showQr && (
          <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl">
            <QRCodeSVG value={publicUrl} size={180} />
            <p className="text-gray-300 text-xs text-center">Escaneie para ouvir a música</p>
          </div>
        )}
      </div>

      {/* RODAPÉ */}
      <div className="mt-12 text-center">
        <a href="/" className="text-pink-400 hover:text-pink-300 text-sm font-medium transition-colors">
          🎵 Criar minha música na FizMusica
        </a>
      </div>
    </div>
  )
}
