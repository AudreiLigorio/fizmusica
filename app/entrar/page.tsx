"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"
import BarraHome from "@/app/components/BarraHome"

export default function EntrarPage() {
  const [email, setEmail]     = useState("")
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")
  // "login": magic link (entra na conta). "link": reenvia o link de token da
  // música (/preparar/[token]) — sem login, pra quem perdeu o e-mail original.
  const [mode, setMode]       = useState<"login" | "link">("login")
  // Nenhum pedido nesse e-mail: mostra a escolha (conferir x criar conta) em
  // vez de recusar. `contaNova` só ajusta o texto da confirmação depois.
  const [semPedido, setSemPedido] = useState(false)
  const [contaNova, setContaNova] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    // Reenvio do link de acesso (sem login) — resposta é sempre genérica.
    if (mode === "link") {
      try {
        await fetch("/api/acesso/reenviar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
        setSent(true)
      } catch {
        setError("Algo deu errado. Tente de novo em instantes.")
      }
      setLoading(false)
      return
    }

    // Verifica se existe algum pedido com esse e-mail antes de enviar o link.
    //
    // Essa checagem NÃO é mais uma barreira — desde que a área abriu pro
    // visitante, criar conta sem ter comprado é legítimo. Ela virou o que
    // sempre foi de fato útil: pegar erro de digitação. Um cliente que escreve
    // "gmial" receberia o link numa boa, criaria uma segunda conta vazia e
    // acharia que perdeu as músicas. Por isso o aviso vem ANTES de qualquer
    // e-mail sair, e seguir em frente exige um segundo clique consciente.
    const check = await fetch("/api/conta/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).then((r) => r.json()).catch(() => ({ hasOrders: true }))

    if (!check.hasOrders) {
      setSemPedido(true)
      setLoading(false)
      return
    }

    await enviarLink(false)
  }

  // Disparo do magic link. `novo` só muda o texto da tela de confirmação —
  // o Supabase cria a conta sozinho quando o e-mail ainda não existe.
  async function enviarLink(novo: boolean) {
    setLoading(true)
    setError("")
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (authError) {
      setError(authError.message)
    } else {
      setContaNova(novo)
      setSent(true)
    }
    setLoading(false)
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
                {mode === "link" ? (
                  <>Se houver pedidos no e-mail{" "}
                  <span className="text-white font-medium">{email}</span>,
                  você receberá o link da sua música em instantes. Confira também a caixa de spam.</>
                ) : contaNova ? (
                  <>Enviamos um link para{" "}
                  <span className="text-white font-medium">{email}</span>.
                  Clique nele para criar sua conta. Confira também a caixa de spam.</>
                ) : (
                  <>Enviamos um link de acesso para{" "}
                  <span className="text-white font-medium">{email}</span>.
                  Clique no link para entrar.</>
                )}
              </p>
              {/* "Digitei o e-mail errado" em vez de "Usar outro e-mail":
                  quem acabou de criar conta fez a coisa CERTA, e o texto
                  antigo sugeria que havia algo a corrigir. Agora só chama
                  quem de fato errou. */}
              <button
                onClick={() => { setSent(false); setEmail(""); setSemPedido(false); setContaNova(false) }}
                className="text-sm text-pink-400 hover:text-pink-300"
              >
                Digitei o e-mail errado
              </button>
            </div>
          ) : (
            <>
              {/* "Entre ou crie sua conta" em vez de "Acompanhe sua música":
                  o texto antigo era linguagem de área de cliente, e quem nunca
                  comprou lia e concluía que a tela não era pra ele — desistia
                  antes de digitar. O caminho de cadastro existia, mas só
                  aparecia DEPOIS de tentar e o e-mail não ser encontrado.
                  Um campo só é o padrão do login sem senha: os dois fluxos são
                  idênticos (digita, recebe link, entra), então perguntar "você
                  já tem conta?" obrigaria a pessoa a responder algo que ela
                  muitas vezes não sabe — e errar levaria a um beco. */}
              <div className="text-center mb-8">
                <span className="text-pink-400 font-bold text-2xl">Fiz Música</span>
                <p className="text-gray-200 text-sm mt-1.5 font-medium">
                  {mode === "link" ? "Receba de novo o link da sua música 🎵" : "Entre ou crie sua conta"}
                </p>
                {mode === "login" && (
                  <p className="text-gray-400 text-xs mt-1">
                    O mesmo e-mail serve pra quem já é cliente e pra quem está começando agora.
                  </p>
                )}
              </div>

              {mode === "login" && (<>
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
              </>)}

              <form
                onSubmit={handleSubmit}
                className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-5"
              >
                <div className="space-y-2">
                  <label className="text-sm text-gray-200 font-medium">Seu e-mail</label>
                  <input
                    type="email"
                    value={email}
                    /* Corrigiu o e-mail? A checagem tem que rodar de novo —
                       senão o cliente que consertou o "gmial" seguiria pelo
                       caminho de criar conta nova. */
                    onChange={(e) => { setEmail(e.target.value); setSemPedido(false); setError("") }}
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

                {/* Âmbar, não vermelho: não é erro. Pra quem nunca comprou é
                    o caminho normal; pra quem errou a digitação é o alerta
                    que evita uma segunda conta vazia. */}
                {semPedido && (
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-4 space-y-3">
                    <p className="text-amber-200 text-sm leading-relaxed">
                      Não encontramos nenhum pedido com <span className="font-medium text-white">{email}</span>.
                    </p>
                    <p className="text-amber-200/70 text-xs leading-relaxed">
                      Se você já comprou, confira se digitou certo — é só corrigir o e-mail acima. Se ainda não comprou, pode criar sua conta agora mesmo.
                    </p>
                    <button
                      type="button"
                      onClick={() => enviarLink(true)}
                      disabled={loading}
                      className="w-full bg-white/10 hover:bg-white/15 disabled:opacity-60 transition-colors py-2.5 rounded-xl text-sm font-semibold"
                    >
                      {loading ? "Enviando…" : "Criar minha conta"}
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || semPedido}
                  className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enviando…
                    </>
                  ) : mode === "link" ? (
                    "Receber o link da minha música 🎵"
                  ) : (
                    "Enviar link de acesso ✉️"
                  )}
                </button>

                <p className="text-xs text-gray-300 text-center">
                  {mode === "link"
                    ? "Enviaremos o link direto da sua música pro e-mail usado na compra — sem login."
                    : "Você receberá um link seguro por e-mail — sem senha necessária."}
                </p>
              </form>

              <button
                onClick={() => { setMode(mode === "link" ? "login" : "link"); setError("") }}
                className="w-full text-center text-xs text-gray-400 hover:text-pink-300 mt-4 underline underline-offset-2"
              >
                {mode === "link"
                  ? "← Voltar para entrar na minha conta"
                  : "Perdeu o link da sua música? Receba de novo por e-mail, sem login"}
              </button>

              <p className="text-[11px] text-gray-500 text-center mt-4 leading-relaxed">
                Ao entrar, você concorda com os{" "}
                <a href="/legal/termos-de-uso" className="underline hover:text-gray-300">Termos de Uso</a> e a{" "}
                <a href="/legal/politica-de-privacidade" className="underline hover:text-gray-300">Política de Privacidade</a>.
              </p>
            </>
          )}
        </div>
      </div>

      <Footer />
      {/* Com a barra: /entrar NÃO é etapa de funil de compra (a regra que
          mantém Criar/Produtos/Checkout sem ela — ver DOCUMENTACAO §18).
          Abandonar o login não custa venda nenhuma, e quem chegou aqui e
          desistiu de entrar consegue ir ouvir a Rede em vez de sair do site. */}
      <BarraHome />
    </div>
  )
}

