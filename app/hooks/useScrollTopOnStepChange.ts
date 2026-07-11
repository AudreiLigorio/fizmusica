"use client"

import { useEffect, useRef, type RefObject } from "react"

// Rola pro topo sempre que `key` mudar — pro container com scroll próprio
// (mobile) e pra janela (desktop). Usado em telas com "etapas"/abas trocadas
// por estado em vez de navegação real, onde o Next.js não reseta o scroll
// sozinho (isso só acontece automaticamente em mudanças de rota).
export function useScrollTopOnStepChange(key: unknown, containerRef?: RefObject<HTMLElement | null>) {
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    containerRef?.current?.scrollTo({ top: 0, behavior: "smooth" })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
