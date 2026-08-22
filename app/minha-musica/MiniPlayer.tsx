"use client"

import { useEffect, useRef } from "react"
import { usePlayer } from "./PlayerContext"

function fmt(s: number): string {
  if (!s || isNaN(s)) return "0:00"
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`
}

export default function MiniPlayer() {
  const { track, playing, progress, duration, activeLine, lines, fullOpen, audioRef, toggle, seek, close, openFull, closeFull, onTimeUpdate } = usePlayer()
  const activeLineRef = useRef<HTMLParagraphElement>(null)

  // Mesmo mecanismo real (PublicMusicPlayer.tsx): scrollIntoView na linha
  // ativa dentro do próprio container, nunca a página inteira.
  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [activeLine])

  if (!track) return null

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={track.audioUrl}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onTimeUpdate}
        onEnded={close}
      />

      {/* barra fixa — só dentro de /minha-musica */}
      <div className="fixed left-0 right-0 bottom-0 z-40 bg-[#130e1c]/95 backdrop-blur-md border-t border-white/10 px-4 py-2.5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={openFull} className="flex items-center gap-3 flex-1 min-w-0 text-left">
            <div
              className="w-10 h-10 rounded-lg flex-none bg-cover bg-center border border-white/10"
              style={track.imageUrl ? { backgroundImage: `url(${track.imageUrl})` } : { background: "linear-gradient(135deg,#3a1440,#7a1f5c)" }}
            />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{track.title}</p>
              <p className="text-[11px] text-white/40 truncate">{track.occasion}</p>
            </div>
          </button>
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-xs shrink-0"
            aria-label={playing ? "Pausar" : "Tocar"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button onClick={close} className="text-white/30 hover:text-white/70 text-sm shrink-0" aria-label="Fechar player">✕</button>
        </div>
      </div>

      {/* player cheio */}
      {fullOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center px-6 pt-6 pb-8" style={{ background: "linear-gradient(180deg, #1f1830, #0b0812)" }}>
          <div className="w-full max-w-md flex items-center justify-between mb-8">
            <button onClick={closeFull} className="text-white/60 hover:text-white text-xl px-1" aria-label="Voltar">▾</button>
            <span className="text-[11px] uppercase tracking-wide text-white/40 font-bold">Tocando agora</span>
            <span className="w-6" />
          </div>

          <div
            className="rounded-2xl mb-7 flex-none bg-cover bg-center border border-white/10"
            style={{
              width: "min(70vw, 300px)", height: "min(70vw, 300px)",
              ...(track.imageUrl ? { backgroundImage: `url(${track.imageUrl})` } : { background: "linear-gradient(135deg,#3a1440,#7a1f5c)" }),
            }}
          />
          <h2 className="text-center text-lg font-semibold mb-1 max-w-sm" style={{ textWrap: "balance" }}>{track.title}</h2>
          <p className="text-sm text-white/40 mb-6">{track.occasion}</p>

          {lines.length > 0 && (
            <>
              <span className="text-[10px] uppercase tracking-wide font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full mb-3">
                🎤 Letra sincronizada
              </span>
              <div
                className="w-full max-w-md h-[150px] overflow-y-auto mb-6 px-2"
                style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)" }}
              >
                <div className="flex flex-col gap-3 text-center py-16">
                  {lines.map((line, i) => {
                    const isActive = i === activeLine
                    const isNear = Math.abs(i - activeLine) <= 1
                    return (
                      <p
                        key={i}
                        ref={isActive ? activeLineRef : undefined}
                        className="select-none transition-all duration-500 px-2"
                        style={{
                          fontSize: isActive ? "1.2rem" : isNear ? "1rem" : ".875rem",
                          fontWeight: isActive ? 700 : isNear ? 500 : 400,
                          color: isActive ? "#fff" : isNear ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.25)",
                          textShadow: isActive ? "0 0 20px rgba(236,72,153,.6)" : "none",
                        }}
                      >
                        {line}
                      </p>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          <div className="w-full max-w-md flex items-center gap-3 mb-6">
            <span className="text-[11px] text-white/40 font-mono shrink-0">{fmt(progress)}</span>
            <input
              type="range" min={0} max={duration || 0} step={0.1} value={progress}
              onChange={(e) => seek(Number(e.target.value))}
              className="flex-1 accent-pink-500 h-1 cursor-pointer"
            />
            <span className="text-[11px] text-white/40 font-mono shrink-0">{fmt(duration)}</span>
          </div>

          <button
            onClick={toggle}
            className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center text-xl"
            aria-label={playing ? "Pausar" : "Tocar"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
        </div>
      )}
    </>
  )
}
