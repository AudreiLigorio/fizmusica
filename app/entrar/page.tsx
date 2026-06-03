"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"

export default function EntrarPage() {
  const [email, setEmail]     = useState("")
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans pt-24">
      <Header showButton={false} />

      <div className="flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-sm">

          {sent ? (
            <div className="text-center bg-white/5 border border-white/10 rounded-3xl p-10">
              <div className="text-5xl mb-5">📧</div>
              <h1 className="text-2xl font-bold mb-3">Verifique seu e-mail</h1>
              <p className="text-gray-400 leading-relaxed mb-6">
                Enviamos um link de acesso para{" "}
                <span className="text-white font-medium">{email}</span>.
                Clique no link para entrar.
              </p>
              <button
                onClick={() => { setSent(false); setEmail("") }}
                className="text-sm text-pink-400 hover:text-pink-300"
              >
                Usar outro e-mail
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <span className="text-pink-400 font-bold text-2xl">Fiz Música</span>
                <p className="text-gray-500 text-sm mt-1">Acompanhe sua música ❤️</p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-5"
              >
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium">Seu e-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    required
                    autoFocus
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-pink-500 transition-colors"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    "Enviar link de acesso ✉️"
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  Você receberá um link seguro por e-mail — sem senha necessária.
                </p>
              </form>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
