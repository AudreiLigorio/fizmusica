"use client"

import { useEffect } from "react"

// Registra o service worker (public/sw.js) — só em produção. No dev ele ficaria
// no meio do hot reload e confundiria testes; lá não há o que ganhar.
export default function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      /* sem service worker o site funciona igual — só perde a página offline */
    })
  }, [])
  return null
}
