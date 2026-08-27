"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useToast } from "./ToastContext"

type Nivel = { id: number; nome: string; icone: string; minDiscos: number; descontoDigital: number; artePrefixo: string | null }
type Carreira = {
  discos: number
  nivel: Nivel
  proximo: Nivel | null
  faltam: number
  progresso: number
  personagem: "m" | "f" | null
  trilha: { id: number; icone: string; nome: string; minDiscos: number }[]
  extrato: { tipo: string; discos: number; descricao: string | null; data: string }[]
}

// "Minha Carreira" — a spec é clara: o personagem é o HERÓI da tela, não um
// ícone. O cliente tem que sentir "meu personagem está ficando famoso", e a
// linguagem é sempre carreira/discos, nunca pontos ou milhagem.
export default function MinhaCarreira() {
  const [c, setC] = useState<Carreira | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [verExtrato, setVerExtrato] = useState(false)
  const { showToast } = useToast()

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ""}` }
  }

  async function carregar() {
    const headers = await authHeaders()
    const d = await fetch("/api/carreira", { headers }).then((r) => r.json()).catch(() => null)
    if (d && !d.error) setC(d)
  }

  useEffect(() => { carregar() }, [])

  async function escolherPersonagem(p: "m" | "f") {
    setSalvando(true)
    const headers = await authHeaders()
    await fetch("/api/perfil", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ personagem: p }),
    })
    await carregar()
    setSalvando(false)
    showToast("Personagem escolhido ✓")
  }

  if (!c) return null

  const arte = c.personagem && c.nivel.artePrefixo
    ? `/carreira/${c.nivel.artePrefixo}-${c.personagem}.webp`
    : null

  return (
    <div className="mb-9">
      <h2 className="text-xl font-bold mb-1">Minha carreira</h2>
      <p className="text-xs text-white/50 mb-4">
        Cada música criada rende discos e faz seu personagem evoluir.
      </p>

      <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "linear-gradient(160deg,#1a1030,#0d0818)" }}>
        {/* Personagem: ocupa o topo inteiro porque é o herói da tela */}
        <div className="flex items-end gap-4 px-5 pt-5">
          {arte ? (
            <img src={arte} alt={`Personagem ${c.nivel.nome}`} className="w-28 h-auto flex-none drop-shadow-[0_8px_24px_rgba(240,25,107,0.35)]" />
          ) : (
            /* Sem escolha ainda: convida em vez de assumir um padrão — errar
               aqui seria errar com metade das pessoas logo na tela mais
               divertida do app. */
            <div className="flex-1 py-2">
              <p className="text-sm font-semibold mb-1">Escolha seu personagem</p>
              <p className="text-[11px] text-white/45 mb-3 leading-relaxed">
                Ele evolui com você a cada nível. Dá pra trocar quando quiser.
              </p>
              <div className="flex gap-2">
                {(["m", "f"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => escolherPersonagem(p)}
                    disabled={salvando}
                    className="flex-1 rounded-xl border border-white/15 hover:border-fuchsia-500/50 bg-black/20 p-2 transition-colors disabled:opacity-50"
                  >
                    <img src={`/carreira/${c.nivel.artePrefixo ?? "nivel-1"}-${p}.webp`} alt="" className="w-full h-auto" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {arte && (
            <div className="min-w-0 flex-1 pb-5">
              <p className="text-[10px] uppercase tracking-wide font-bold text-white/35 mb-0.5">Seu nível</p>
              <p className="text-lg font-bold leading-tight mb-2">{c.nivel.icone} {c.nivel.nome}</p>
              <p className="text-2xl font-bold" style={{ color: "#f0abfc" }}>
                {c.discos} <span className="text-sm font-medium text-white/50">disco{c.discos === 1 ? "" : "s"} 💿</span>
              </p>
            </div>
          )}
        </div>

        {arte && (
          <div className="px-5 pb-5 pt-4">
            {/* Progresso pro próximo nível */}
            {c.proximo ? (
              <>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[11px] text-white/50">
                    Faltam <strong className="text-white">{c.faltam}</strong> disco{c.faltam === 1 ? "" : "s"} para {c.proximo.icone} {c.proximo.nome}
                  </span>
                  <span className="text-[11px] text-white/35 font-mono">{c.discos}/{c.proximo.minDiscos}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-4">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.round(c.progresso * 100)}%`, background: "linear-gradient(90deg,#f0196b,#d946ef)" }}
                  />
                </div>
              </>
            ) : (
              <p className="text-[11px] text-white/50 mb-4">
                Você chegou ao topo da carreira. ⭐
              </p>
            )}

            {/* Trilha completa — mostra a jornada inteira, não só o passo atual */}
            <div className="flex items-center justify-between mb-4">
              {c.trilha.map((n) => {
                const alcancado = c.discos >= n.minDiscos
                const atual = n.id === c.nivel.id
                return (
                  <div key={n.id} className="flex flex-col items-center gap-1 flex-1" title={n.nome}>
                    <span className={`text-lg transition-all ${alcancado ? "" : "opacity-25 grayscale"} ${atual ? "scale-125" : ""}`}>
                      {n.icone}
                    </span>
                    <span className={`text-[8px] text-center leading-tight ${atual ? "text-white font-bold" : "text-white/30"}`}>
                      {n.minDiscos}+
                    </span>
                  </div>
                )
              })}
            </div>

            {c.nivel.descontoDigital > 0 && (
              <div className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/10 px-4 py-2.5 mb-3">
                <p className="text-xs font-semibold text-fuchsia-200">
                  🎁 {c.nivel.descontoDigital}% de desconto na próxima música
                </p>
              </div>
            )}

            <button
              onClick={() => setVerExtrato((v) => !v)}
              className="w-full text-center text-[11px] text-white/40 hover:text-white/70 py-1 transition-colors"
            >
              {verExtrato ? "Ocultar histórico ▲" : "Ver de onde vieram meus discos ▾"}
            </button>

            {verExtrato && (
              <div className="mt-2 space-y-1.5">
                {c.extrato.length === 0 && <p className="text-[11px] text-white/30 text-center py-2">Nada por aqui ainda.</p>}
                {c.extrato.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] border-b border-white/5 pb-1.5">
                    <span className={`font-bold font-mono shrink-0 ${t.discos > 0 ? "text-green-400" : "text-red-400"}`}>
                      {t.discos > 0 ? "+" : ""}{t.discos}
                    </span>
                    <span className="text-white/55 flex-1 min-w-0 truncate">{t.descricao ?? t.tipo}</span>
                    <span className="text-white/25 shrink-0">
                      {new Date(t.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
