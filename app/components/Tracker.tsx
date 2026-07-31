"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { track } from "@/lib/track"

// Registra a visualização de cada página. Fica no layout raiz, então cobre o
// site inteiro sem precisar tocar em cada tela — inclusive as landings por tema,
// que são o destino dos links rastreados dos posts.
export default function Tracker() {
  const pathname = usePathname()

  useEffect(() => {
    // Painel administrativo não é comportamento de visitante.
    if (pathname?.startsWith("/admin")) return
    track("pageview")
  }, [pathname])

  return null
}
