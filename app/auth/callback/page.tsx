"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

// Página de retorno do login: roda no NAVEGADOR para que a sessão seja
// gravada no browser (localStorage) e o cliente fique de fato logado.
export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      const url = new URL(window.location.href)
      const token_hash = url.searchParams.get("token_hash")
      const type = url.searchParams.get("type") as
        | "email" | "magiclink" | "recovery" | "signup" | "invite" | "email_change" | null

      // Fluxo token_hash (link mágico): valida no navegador → grava sessão
      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type })
        if (!error) { router.replace("/minha-musica"); return }
      }

      // Fallback: se a sessão já tiver sido detectada na URL (fluxo implícito)
      const { data } = await supabase.auth.getSession()
      if (data.session) { router.replace("/minha-musica"); return }

      router.replace("/entrar?erro=link-invalido")
    })()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#07060d" }}>
      <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-white/60 text-sm">Entrando…</p>
    </div>
  )
}
