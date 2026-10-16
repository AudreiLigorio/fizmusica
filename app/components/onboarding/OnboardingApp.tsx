"use client"

import { useEffect, useRef } from "react"
import "./onboarding.css"
import { MARCACAO } from "./marcacao"
import { iniciarOnboarding } from "./motor"
import { track } from "@/lib/track"

// As telas do onboarding (carregadas só quando vão aparecer — ver
// OnboardingPortao.tsx). A lógica vive em motor.js, igual ao protótipo
// aprovado; aqui só montamos, travamos a rolagem da página por baixo e
// devolvemos o destino final.
export type DestinoOnboarding = "criar" | "spotfiz" | "pular"

export default function OnboardingApp({ onFechar }: { onFechar: (d: DestinoOnboarding) => void }) {
  const raiz = useRef<HTMLDivElement>(null)
  const fechar = useRef(onFechar)
  useEffect(() => { fechar.current = onFechar })

  useEffect(() => {
    const el = raiz.current
    if (!el) return
    el.innerHTML = MARCACAO
    const rolagemAntes = document.body.style.overflow
    document.body.style.overflow = "hidden"
    track("onboarding_abriu")
    const limpar = iniciarOnboarding(el, {
      // Personagem da Carreira, do nível 1 ao 5 (arte feminina, como no protótipo)
      artes: [1, 2, 3, 4, 5].map((n) => `/carreira/nivel-${n}-f.webp`),
      aoFechar: (destino: DestinoOnboarding) => fechar.current(destino),
      track: (evento: string, detalhe?: string) => track(evento, detalhe),
    })
    return () => {
      limpar()
      document.body.style.overflow = rolagemAntes
      el.innerHTML = ""
    }
  }, [])

  // data-zona-escura: o tema claro do site não repinta o onboarding
  return <div ref={raiz} className="onb" data-zona-escura role="dialog" aria-modal="true" aria-label="Conheça o Fiz Música" />
}
