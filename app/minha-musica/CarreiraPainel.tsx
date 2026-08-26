"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useToast } from "./ToastContext"

const MAX_APELIDO = 24

// Cabeçalho da aba Carreira: quem é o cliente e onde ele vai crescer.
//
// Apelido e foto são PRIVADOS por decisão — só aparecem aqui. A Rede Fiz
// Música segue anônima; se um dia o apelido virar autor público lá, precisa de
// aceite separado (publication_consent cobre a música, não o rosto de quem
// comprou).
export default function CarreiraPainel({ nome, email }: { nome: string; email: string }) {
  const [apelido, setApelido] = useState("")
  const [salvo, setSalvo] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ""}` }
  }

  async function carregar() {
    const headers = await authHeaders()
    const d = await fetch("/api/perfil", { headers }).then((r) => r.json()).catch(() => ({}))
    setApelido(d.apelido ?? "")
    setSalvo(d.apelido ?? "")
    setAvatarUrl(d.avatarUrl ?? null)
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function salvarApelido() {
    const limpo = apelido.trim()
    if (limpo === salvo.trim()) return
    const headers = await authHeaders()
    await fetch("/api/perfil", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ apelido: limpo }),
    })
    setSalvo(limpo)
    showToast("Apelido salvo ✓")
  }

  async function enviarFoto(file: File) {
    setEnviando(true); setErro("")
    const headers = await authHeaders()
    const body = new FormData()
    body.append("file", file)
    const res = await fetch("/api/perfil/foto", { method: "POST", headers, body })
    const d = await res.json().catch(() => ({}))
    setEnviando(false)
    if (d.error) { setErro(d.error); return }
    setAvatarUrl(d.avatarUrl ?? null)
    showToast("Foto atualizada ✓")
  }

  const inicial = (nome || email || "?").trim().charAt(0).toUpperCase()

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6" style={{ borderLeft: "3px solid #d946ef" }}>
      <div className="flex items-center gap-3.5 mb-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={enviando}
          aria-label="Trocar foto do perfil"
          className="relative w-16 h-16 rounded-full shrink-0 overflow-hidden group disabled:opacity-60"
          style={avatarUrl ? undefined : { background: "linear-gradient(135deg,#f0196b,#d946ef)" }}
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            : <span className="text-xl font-bold text-white">{inicial}</span>}
          <span className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-semibold text-white">
            {enviando ? "…" : "Trocar"}
          </span>
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarFoto(f); e.target.value = "" }}
        />

        <div className="min-w-0 flex-1">
          <p className="font-bold text-base truncate">{salvo || nome}</p>
          <p className="text-xs text-white/45 truncate">{email}</p>
          <p className="text-[11px] text-white/30 mt-0.5">É por este e-mail que seus pedidos entram na conta.</p>
        </div>
      </div>

      {erro && <p className="text-red-400 text-[11px] mb-3">{erro}</p>}

      <label htmlFor="apelido" className="block text-[11px] font-semibold text-white/50 mb-1.5">
        Como você quer ser chamado
      </label>
      <div className="flex gap-2 mb-4">
        <input
          id="apelido"
          value={apelido}
          onChange={(e) => setApelido(e.target.value.slice(0, MAX_APELIDO))}
          onBlur={salvarApelido}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
          maxLength={MAX_APELIDO}
          placeholder={nome || "Seu apelido"}
          className="flex-1 min-w-0 bg-black/25 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-fuchsia-500/50 transition-colors placeholder:text-white/25"
        />
        <button
          type="button"
          onClick={salvarApelido}
          disabled={apelido.trim() === salvo.trim()}
          className="shrink-0 px-4 rounded-xl text-xs font-bold text-white disabled:opacity-30 transition-all"
          style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)" }}
        >
          Salvar
        </button>
      </div>

      {/* Nível travado de propósito: o programa de fidelidade está
          especificado mas não construído, e número falso seria pior do que
          dizer que ainda não chegou. */}
      <div className="rounded-xl border border-dashed border-white/12 bg-black/20 px-4 py-3.5">
        <div className="flex items-center gap-2 mb-1">
          <svg
            viewBox="0 0 24 24" className="w-4 h-4 text-white/30 shrink-0" aria-hidden="true"
            fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="12" cy="9" r="6" />
            <path d="M8.2 14.3 7 22l5-3 5 3-1.2-7.7" />
          </svg>
          <p className="text-xs font-semibold text-white/60">Seu nível de cantor</p>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-white/30 border border-white/12 rounded-full px-2 py-0.5 shrink-0">
            Em breve
          </span>
        </div>
        <p className="text-[11px] text-white/35 leading-relaxed">
          Cada música criada e cada amigo indicado vão virar pontos aqui — com
          personagem que evolui conforme você sobe de nível.
        </p>
      </div>
    </div>
  )
}
