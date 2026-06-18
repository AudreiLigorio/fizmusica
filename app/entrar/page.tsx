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

  async function handleGoogle() {
    setError("")
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (authError) setError(authError.message)
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
              <p className="text-gray-200 leading-relaxed mb-6">
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
                <p className="text-gray-300 text-sm mt-1">Acompanhe sua música ❤️</p>
              </div>

              <button
                onClick={handleGoogle}
                className="w-full mb-4 bg-white text-gray-800 hover:bg-gray-100 transition-colors py-3 rounded-2xl font-semibold flex items-center justify-center gap-3"
              >
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.5l-6.6-5.6C29.6 34.6 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.6 5.6C41.4 36.3 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
                Entrar com Google
              </button>

              <div className="flex items-center gap-3 mb-4">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-gray-500">ou pelo e-mail</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <form
                onSubmit={handleSubmit}
                className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-5"
              >
                <div className="space-y-2">
                  <label className="text-sm text-gray-200 font-medium">Seu e-mail</label>
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

                <p className="text-xs text-gray-300 text-center">
                  Você receberá um link seguro por e-mail — sem senha necessária.
                </p>
              </form>

              <p className="text-[11px] text-gray-500 text-center mt-4 leading-relaxed">
                Ao entrar, você concorda com os{" "}
                <a href="/legal/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">Termos de Uso</a> e a{" "}
                <a href="/legal/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">Política de Privacidade</a>.
              </p>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}

