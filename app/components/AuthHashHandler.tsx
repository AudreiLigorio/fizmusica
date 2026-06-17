"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase"

// Captura o login que chega via fragmento (#access_token=...) em QUALQUER página
// — inclusive a home — e leva o cliente já logado para a área dele.
// Torna o login resiliente independentemente do template/redirect do Supabase.
export default function AuthHashHandler() {
  useEffect(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash
    if (!hash.includes("access_token") && !hash.includes("error_description")) return

    // O supabase-js (detectSessionInUrl) processa o fragmento automaticamente.
    // Assim que a sessão for estabelecida, redirecionamos para a área.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // limpa o # e vai para a área
        window.location.replace("/minha-musica")
      }
    })

    // fallback: se já houver sessão detectada
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && window.location.hash.includes("access_token")) {
        window.location.replace("/minha-musica")
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  return null
}
