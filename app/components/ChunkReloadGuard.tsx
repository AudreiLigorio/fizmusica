"use client"

import { useEffect } from "react"

// Após um deploy, quem está com a página aberta pode tentar carregar um "chunk"
// (pedaço do app) que o deploy substituiu → "This page couldn't load". Aqui
// detectamos esse erro e recarregamos a página UMA vez (trava anti-loop), então o
// cliente nem percebe — a página recarrega com os arquivos novos e segue.
const RELOAD_KEY = "__chunk_reload_at"

function isChunkError(input: unknown): boolean {
  const err = input as { message?: string; name?: string; reason?: { message?: string; name?: string } } | null
  const msg = String(err?.message ?? err?.reason?.message ?? err?.reason ?? err ?? "")
  const name = String(err?.name ?? err?.reason?.name ?? "")
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /importing a module script failed/i.test(msg) // frase do Safari/iOS
  )
}

export default function ChunkReloadGuard() {
  useEffect(() => {
    function recover() {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0")
        // Se já recarregou nos últimos 15s, não recarrega de novo (evita loop se o
        // reload não resolver — aí o erro real aparece em vez de piscar pra sempre).
        if (Date.now() - last < 15000) return
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
      } catch {}
      window.location.reload()
    }
    function onError(e: ErrorEvent) {
      const target = e.target as (HTMLElement & { src?: string; href?: string }) | null
      const isResource = !!target && (target.tagName === "SCRIPT" || target.tagName === "LINK")
      const resourceUrl = isResource ? (target.src ?? target.href ?? "") : ""
      if (isChunkError(e.error) || isChunkError(e) || (isResource && /_next\/static/.test(resourceUrl))) {
        recover()
      }
    }
    function onRejection(e: PromiseRejectionEvent) {
      if (isChunkError(e.reason)) recover()
    }
    // capture=true: erros de carregamento de <script>/<link> não borbulham.
    window.addEventListener("error", onError, true)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError, true)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])
  return null
}
