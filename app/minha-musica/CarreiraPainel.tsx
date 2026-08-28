"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useToast } from "./ToastContext"

const MAX_APELIDO = 24

// Cabeçalho da aba Carreira: quem é o cliente e onde ele vai crescer.
//
// Apelido e foto ficam salvos aqui, privados por padrão. O apelido pode
// aparecer publicamente nas músicas que o cliente publica na Rede Fiz
// Música — mas só se ele ligar `mostrarApelido` explicitamente. É um opt-in
// separado do consentimento de publicar a música: aquele nunca foi pensado
// pra expor identidade de ninguém.
export default function CarreiraPainel({ nome, email }: { nome: string; email: string }) {
  const [apelido, setApelido] = useState("")
  const [salvo, setSalvo] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [mostrarApelido, setMostrarApelido] = useState(false)
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
    setMostrarApelido(!!d.mostrarApelido)
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

  async function alternarMostrarApelido(v: boolean) {
    setMostrarApelido(v) // otimista
    const headers = await authHeaders()
    await fetch("/api/perfil", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ mostrarApelido: v }),
    })
    showToast(v ? "Apelido visível na Rede ✓" : "Apelido voltou a ser privado ✓")
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6">
      <div className="flex items-center gap-3.5 mb-4">
        {/* O upload sempre existiu — o círculo É o botão. Só que a única
            pista disso era um "Trocar" que aparecia no HOVER, e hover não
            existe em celular: no toque, nada indicava que dava pra clicar,
            e o cliente concluía que faltava o campo de foto.
            Agora a câmera fica fixa na borda, visível em qualquer aparelho. */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={enviando}
          aria-label={avatarUrl ? "Trocar foto do perfil" : "Adicionar foto do perfil"}
          className="relative w-16 h-16 shrink-0 group disabled:opacity-60"
        >
          <span
            className="block w-full h-full rounded-full overflow-hidden"
            style={avatarUrl ? undefined : { background: "linear-gradient(135deg,#f0196b,#d946ef)" }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : <span className="w-full h-full flex items-center justify-center text-xl font-bold text-white">{inicial}</span>}
            <span className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-semibold text-white">
              {enviando ? "…" : "Trocar"}
            </span>
          </span>
          {/* Câmera em SVG, não emoji: o 📷 é escuro por natureza e sumia
              sobre o rosa da marca. Mesma razão já registrada nos ícones das
              abas — emoji vem da fonte do sistema e não aceita cor. */}
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#0d0b14] text-white"
            style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)" }}
          >
            {enviando ? (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )}
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
          {/* Em texto também: ícone sozinho ainda deixa dúvida sobre o que
              acontece ao tocar, e quem não tem foto precisa saber que pode
              colocar uma. */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={enviando}
            className="text-[11px] text-pink-400 hover:text-pink-300 disabled:opacity-50 mt-1.5"
          >
            {enviando ? "Enviando…" : avatarUrl ? "Trocar foto" : "Adicionar foto"}
          </button>
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

      {/* Opt-in separado de propósito: publication_consent (lá no pedido) só
          autoriza publicar a música. Mostrar o apelido é outra decisão, então
          fica com o próprio interruptor, desligado até o cliente ligar. */}
      <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-4 py-3 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={mostrarApelido}
          onChange={(e) => alternarMostrarApelido(e.target.checked)}
          className="sr-only peer"
        />
        <span
          className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${mostrarApelido ? "bg-fuchsia-500" : "bg-white/15"}`}
          aria-hidden="true"
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${mostrarApelido ? "translate-x-4" : ""}`} />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold">Mostrar meu apelido na Rede Fiz Música</span>
          <span className="block text-[11px] text-white/40">Aparece pra quem ouvir as músicas que você publicou lá</span>
        </span>
      </label>

    </div>
  )
}
