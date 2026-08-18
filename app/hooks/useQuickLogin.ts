"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

// Login rápido pós-pagamento: Google (um toque) ou link mágico pro e-mail que
// já sabemos (não pede pra digitar de novo). Usado em /sucesso e em
// /preparar/[token] — os dois precisam da mesma coisa, só com visual diferente.
//
// `vincularToken`, quando presente, viaja na URL de retorno (?vincular=) em vez
// de localStorage: assim funciona mesmo se o link de e-mail for aberto num
// aparelho diferente de onde o login foi pedido. /auth/callback lê esse
// parâmetro e volta pra /preparar/[token], que completa o vínculo do pedido
// à conta e manda pra /minha-musica.
export function useQuickLogin(email: string | null | undefined, vincularToken?: string | null) {
  const [sending, setSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState("")

  function redirectTo() {
    const base = `${window.location.origin}/auth/callback`
    return vincularToken ? `${base}?vincular=${vincularToken}` : base
  }

  async function withGoogle() {
    setError("")
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    })
    if (authError) setError(authError.message)
  }

  async function withEmail() {
    if (!email) return
    setError("")
    setSending(true)
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    })
    setSending(false)
    if (authError) setError(authError.message)
    else setEmailSent(true)
  }

  return { withGoogle, withEmail, sending, emailSent, error }
}
