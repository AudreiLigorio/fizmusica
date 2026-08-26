"use client"

import { createContext, useContext, useRef, useState, useCallback } from "react"

export type PlayableTrack = {
  id: string
  title: string
  occasion: string
  audioUrl: string
  imageUrl: string | null
  lyrics: string | null
  lyricsLrc: string | null
}

type LrcLine = { time: number; text: string }

// Mesmo parser de app/m/[slug]/PublicMusicPlayer.tsx — duplicado aqui (não
// existe um módulo compartilhado hoje) em vez de importar o player público,
// que é uma tela inteira própria (fotos, QR, compartilhar), não um hook.
function parseLrc(lrc: string): LrcLine[] {
  const result: LrcLine[] = []
  for (const raw of lrc.split("\n")) {
    const line = raw.trim()
    const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{1,3})\](.*)$/)
    if (!match) continue
    const minutes = parseInt(match[1])
    const seconds = parseInt(match[2])
    const ms = parseInt(match[3].padEnd(3, "0"))
    result.push({ time: minutes * 60 + seconds + ms / 1000, text: match[4].trim() })
  }
  return result.sort((a, b) => a.time - b.time).filter((l) => l.text && !/^\[.*\]$/.test(l.text))
}

type PlayerState = {
  track: PlayableTrack | null
  playing: boolean
  progress: number
  duration: number
  activeLine: number
  lines: string[]
  fullOpen: boolean
  repeat: boolean
  audioRef: React.RefObject<HTMLAudioElement | null>
  playTrack: (t: PlayableTrack) => void
  toggle: () => void
  toggleRepeat: () => void
  seek: (t: number) => void
  close: () => void
  openFull: () => void
  closeFull: () => void
  onTimeUpdate: () => void
}

const PlayerCtx = createContext<PlayerState | null>(null)

// Um só "tocando agora" dentro de /minha-musica — escopo confirmado com o
// Audrei (não é global no site, some quando sai da área do cliente).
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [track, setTrack] = useState<PlayableTrack | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [activeLine, setActiveLine] = useState(0)
  const [fullOpen, setFullOpen] = useState(false)
  // Repetir: usa o `loop` nativo do <audio>, então a faixa reinicia sem
  // passar pelo onEnded (que é quem fecha o player no fim normal).
  const [repeat, setRepeat] = useState(false)

  const lrcLines = track?.lyricsLrc ? parseLrc(track.lyricsLrc) : null
  const plainLines = (track?.lyrics ?? "").split("\n").map((l) => l.trim()).filter((l) => l && !/^\[.*\]$/.test(l))
  const lines = lrcLines ? lrcLines.map((l) => l.text) : plainLines

  const playTrack = useCallback((t: PlayableTrack) => {
    setTrack(t)
    setActiveLine(0)
    setProgress(0)
    // Só troca o src depois do state — o próximo render já aponta o <audio> pra cá.
    requestAnimationFrame(() => { audioRef.current?.play().catch(() => {}) })
    setPlaying(true)
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause(); else audio.play().catch(() => {})
    setPlaying(!playing)
  }, [playing])

  const seek = useCallback((t: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = t
    setProgress(t)
  }, [])

  const close = useCallback(() => {
    audioRef.current?.pause()
    setTrack(null)
    setPlaying(false)
    setFullOpen(false)
  }, [])

  const onTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const t = audio.currentTime
    const d = audio.duration || 0
    setProgress(t)
    setDuration(d)
    if (lrcLines && lrcLines.length > 0) {
      let idx = 0
      for (let i = 0; i < lrcLines.length; i++) { if (t >= lrcLines[i].time) idx = i; else break }
      setActiveLine(idx)
    } else if (plainLines.length > 0 && d > 0) {
      setActiveLine(Math.min(Math.floor((t / d) * plainLines.length), plainLines.length - 1))
    }
  }, [lrcLines, plainLines])

  const value: PlayerState = {
    track, playing, progress, duration, activeLine, lines, fullOpen, repeat, audioRef,
    playTrack, toggle, seek, close,
    toggleRepeat: () => setRepeat((r) => !r),
    openFull: () => setFullOpen(true),
    closeFull: () => setFullOpen(false),
    onTimeUpdate,
  }

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>
}

export function usePlayer() {
  const ctx = useContext(PlayerCtx)
  if (!ctx) throw new Error("usePlayer precisa estar dentro de <PlayerProvider>")
  return ctx
}
