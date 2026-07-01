"use client"

import { useCallback, useEffect, useRef, useState } from "react"

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

type Props = {
  /** Chamado com o texto final reconhecido — o pai decide se substitui ou concatena */
  onResult: (text: string) => void
  /** Chamado durante o reconhecimento com texto parcial (interim). Opcional. */
  onInterim?: (text: string) => void
  size?: "sm" | "md"
  className?: string
}

export default function MicButton({ onResult, onInterim, size = "md", className = "" }: Props) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening]  = useState(false)
  const recRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null)

  useEffect(() => {
    setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))
  }, [])

  const stop = useCallback(() => {
    recRef.current?.stop()
    recRef.current = null
    setListening(false)
    onInterim?.("")
  }, [onInterim])

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    const r = new SR()
    r.lang = "pt-BR"
    r.interimResults = true
    r.continuous    = false
    r.maxAlternatives = 1

    r.onresult = (e) => {
      let interimText = ""
      let finalText   = ""
      for (const result of Array.from(e.results)) {
        if (result.isFinal) finalText   += result[0].transcript
        else                interimText += result[0].transcript
      }
      if (interimText) onInterim?.(interimText)
      if (finalText) {
        onResult(finalText.trim())
        onInterim?.("")
      }
    }

    r.onend  = () => { setListening(false); onInterim?.("") }
    r.onerror = () => { setListening(false); onInterim?.("") }

    recRef.current = r
    r.start()
    setListening(true)
  }, [onResult, onInterim])

  if (!supported) return null

  const isSmall = size === "sm"

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      title={listening ? "Parar gravação" : "Falar para preencher"}
      aria-label={listening ? "Parar gravação" : "Falar para preencher"}
      className={`shrink-0 flex items-center justify-center rounded-full border transition-all select-none ${
        isSmall ? "w-8 h-8 text-base" : "w-10 h-10 text-lg"
      } ${
        listening
          ? "border-red-500/60 bg-red-500/15 text-red-400 animate-pulse"
          : "border-pink-500/30 bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 active:scale-95"
      } ${className}`}
    >
      {listening ? "🔴" : "🎤"}
    </button>
  )
}
