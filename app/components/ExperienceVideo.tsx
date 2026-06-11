"use client"

import { useState, useRef } from "react"

/**
 * Vídeo da seção "A Experiência".
 * Vertical (formato Instagram 9:16), responsivo em web e mobile.
 * Carrega o arquivo só quando o usuário clica no play (evita baixar 60MB no load da página).
 */
export default function ExperienceVideo() {
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  function handlePlay() {
    setPlaying(true)
    // Aguarda o <video> montar para dar play
    requestAnimationFrame(() => videoRef.current?.play().catch(() => {}))
  }

  return (
    <div className="relative mx-auto w-full max-w-[300px] lg:max-w-[340px]">
      <div
        className="relative rounded-3xl overflow-hidden cursor-pointer group"
        style={{
          aspectRatio: "9 / 16",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
        onClick={!playing ? handlePlay : undefined}
      >
        {playing ? (
          <video
            ref={videoRef}
            src="/videos/experiencia.mp4"
            controls
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <>
            {/* Capa com gradiente + botão de play */}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(135deg, rgba(240,25,107,0.18) 0%, rgba(217,70,239,0.10) 100%)" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="relative w-16 h-16 rounded-full flex items-center justify-center text-xl text-white transition-all duration-300 group-hover:scale-110"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  boxShadow: "0 8px 32px rgba(240,25,107,0.3)",
                }}
              >
                ▶
              </div>
            </div>
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <span className="text-xs text-white/70 tracking-wide">Toque para assistir</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
