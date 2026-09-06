"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import InfoTooltip from "./InfoTooltip"

type Funil = { code: string | null; shares: number; accesses: number; conversions: number }

export default function ReferirAmigos() {
  const [funil, setFunil] = useState<Funil | null>(null)
  const [sharing, setSharing] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ""}` }
  }

  // Protegido porque roda na montagem — mesmo padrão do erro visto no
  // Sentry em MinhasPlaylists.
  async function carregar() {
    try {
      const headers = await authHeaders()
      // Garante que o código existe (get-or-create) antes de puxar o funil.
      await fetch("/api/referral/code", { headers })
      const res = await fetch("/api/referral/funil", { headers })
      const d = await res.json().catch(() => ({}))
      setFunil(d)
    } catch {
      /* sem funil: o painel mostra o estado vazio em vez de quebrar */
    }
  }

  useEffect(() => { carregar() }, [])

  if (!funil?.code) return null

  const link = `https://fizmusica.com.br/i/${funil.code}`

  function compartilhar() {
    // window.open tem que ser a primeira coisa a rodar, de forma síncrona —
    // se vier depois de um await, o navegador mobile perde o "gesto do
    // usuário" e a página atual navega direto pro WhatsApp em vez de abrir
    // uma aba nova (era exatamente esse o bug: "perdeu a tela").
    const msg = `Oi! Fiz uma música personalizada pra alguém especial na Fiz Música e me emocionei com o resultado 🥹🎶 Dá pra criar uma pra quem você ama também, é rapidinho: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener")

    setSharing(true)
    ;(async () => {
      const headers = await authHeaders()
      // Regra do funil: compartilhamento não gera disco, só conta a etapa 1.
      await fetch("/api/referral/share", { method: "POST", headers }).catch(() => {})
      setSharing(false)
      await carregar()
    })()
  }

  async function copiarLink() {
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="mb-9">
      <div className="flex items-center gap-2.5 mb-1">
        <h2 className="text-xl font-bold flex-1 min-w-0 truncate">Indique amigos</h2>
        <InfoTooltip text="Faça indicações e ganhe bônus." />
      </div>
      <p className="text-xs text-white/50 leading-relaxed mb-3">
        Seu link pessoal — quando um amigo compra pela sua indicação, você fica sabendo aqui.
      </p>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 min-w-0 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 truncate font-mono">
          {link}
        </div>
        <button
          onClick={copiarLink}
          className="shrink-0 px-3 py-2 rounded-lg text-xs font-medium border border-white/15 text-white/70 hover:text-white hover:border-fuchsia-500/40 transition-colors"
        >
          {copiado ? "Copiado ✓" : "Copiar"}
        </button>
      </div>

      <button
        onClick={compartilhar}
        disabled={sharing}
        className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-all flex items-center justify-center gap-2 mb-4"
        style={{ background: "#25d366" }}
      >
        💬 Compartilhar no WhatsApp
      </button>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold font-mono">{funil.shares}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wide">Compartilhados</p>
        </div>
        <div>
          <p className="text-lg font-bold font-mono">{funil.accesses}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wide">Acessos</p>
        </div>
        <div>
          <p className="text-lg font-bold font-mono text-green-400">{funil.conversions}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wide">Compras geradas</p>
        </div>
      </div>
    </div>
  )
}
