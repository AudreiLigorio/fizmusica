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
  trilha: { id: number; icone: string; nome: string; minDiscos: number; descontoDigital: number; artePrefixo: string | null }[]
  extrato: { tipo: string; discos: number; descricao: string | null; data: string }[]
}

// "Minha Carreira" — a spec é clara: o personagem é o HERÓI da tela, não um
// ícone. O cliente tem que sentir "meu personagem está ficando famoso", e a
// linguagem é sempre carreira/discos, nunca pontos ou milhagem.
export default function MinhaCarreira() {
  const [c, setC] = useState<Carreira | null>(null)
  // "Faltam 4 💿" é exato mas abstrato: a tela do cliente logado nunca
  // explicava o que é um disco. A explicação já existia — mas só na tela do
  // VISITANTE. Vem do banco (/api/produtos), então continua correta quando o
  // Audrei mexer nos valores no admin; escrever "faltam 2 músicas" no código
  // quebraria nesse dia, e ninguém perceberia. Além disso seria mentira: com
  // os valores atuais uma música vale de 1 a 4 discos, dependendo do plano.
  const [produtos, setProdutos] = useState<{ id: string; name: string; price: number; loyalty_discos: number }[] | null>(null)
  const [verComoGanhar, setVerComoGanhar] = useState(false)
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

  // Só busca quando o cliente abre — quem não tem dúvida não paga a consulta.
  useEffect(() => {
    if (!verComoGanhar || produtos) return
    fetch("/api/produtos")
      .then((r) => r.json())
      .then((d) => setProdutos([...(d.products ?? [])].sort((a, b) => a.price - b.price)))
      .catch(() => setProdutos([]))
  }, [verComoGanhar, produtos])

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
            {/* O foco é o que FALTA e o que se ganha com isso — não o que
                gerou o nível atual, que é retrospectiva e não move ninguém.
                O prêmio ("o desconto sobe de 15% para 20%") vinha separado
                mais abaixo na tela, sem ligação com o esforço. */}
            {c.proximo ? (
              <>
                <div className="flex items-baseline justify-between mb-1.5 gap-3">
                  <span className="text-[11px] text-white/60 min-w-0">
                    Faltam <strong className="text-white">{c.faltam} 💿</strong> para {c.proximo.icone} <strong className="text-white">{c.proximo.nome}</strong>
                  </span>
                  <span className="text-[11px] text-white/35 font-mono shrink-0">{c.discos}/{c.proximo.minDiscos}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.round(c.progresso * 100)}%`, background: "linear-gradient(90deg,#f0196b,#d946ef)" }}
                  />
                </div>
                {c.proximo.descontoDigital > c.nivel.descontoDigital && (
                  <p className="text-[11px] text-fuchsia-300/90 mb-4">
                    Lá o desconto sobe de {c.nivel.descontoDigital}% para <strong>{c.proximo.descontoDigital}%</strong>.
                  </p>
                )}
              </>
            ) : (
              /* Topo: o estado mais vazio do programa até aqui — quem mais
                 gastou era quem tinha menos motivo pra voltar. Vira conquista,
                 e o desconto máximo passa a ser lembrado como permanente. */
              <div className="mb-4 rounded-2xl px-4 py-3 border border-amber-400/25 bg-amber-400/[0.07]">
                <p className="text-sm font-bold text-amber-200">⭐ Você chegou ao topo da carreira</p>
                <p className="text-[11px] text-amber-100/60 mt-0.5 leading-relaxed">
                  Seu personagem passou por todos os palcos. O desconto máximo de {c.nivel.descontoDigital}% fica valendo em toda música que você criar.
                </p>
              </div>
            )}

            {/* Trilha com os PERSONAGENS, não emojis.
                Emoji cinza não faz ninguém querer chegar lá — ver o próprio
                personagem de sobretudo dourado, apagado, esperando, faz. As 10
                artes já existiam e só uma aparecia (a do nível atual); a tela
                do visitante já mostrava a trilha inteira, então o cliente
                logado — que é quem tem motivo pra subir — via MENOS que quem
                nem tem conta. */}
            <div className="flex items-end justify-between gap-1 mb-4">
              {c.trilha.map((n) => {
                const alcancado = c.discos >= n.minDiscos
                const atual = n.id === c.nivel.id
                const proximo = n.id === c.proximo?.id
                const arteN = c.personagem && n.artePrefixo
                  ? `/carreira/${n.artePrefixo}-${c.personagem}.webp`
                  : null
                return (
                  <div key={n.id} className="flex flex-col items-center gap-1 flex-1 min-w-0" title={n.nome}>
                    {arteN ? (
                      <img
                        src={arteN}
                        alt={n.nome}
                        className={`w-full max-w-[52px] h-auto transition-all ${
                          atual ? "" : alcancado ? "opacity-60" : "opacity-25 grayscale"
                        } ${proximo ? "opacity-70 grayscale-0" : ""}`}
                        style={atual ? { filter: "drop-shadow(0 4px 14px rgba(240,25,107,0.55))" } : undefined}
                      />
                    ) : (
                      <span className={`text-lg ${alcancado ? "" : "opacity-25 grayscale"} ${atual ? "scale-125" : ""}`}>{n.icone}</span>
                    )}
                    <span className={`text-[8px] text-center leading-tight ${
                      atual ? "text-white font-bold" : proximo ? "text-fuchsia-300" : "text-white/30"
                    }`}>
                      {n.minDiscos}+
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Como se ganha um disco — recolhido, porque só interessa a quem
                está com a dúvida. Sem isso "faltam 4 💿" não diz o que fazer. */}
            <button
              onClick={() => setVerComoGanhar((v) => !v)}
              className="w-full text-left text-[11px] text-white/45 hover:text-white/70 transition-colors mb-3"
            >
              Como se ganha um 💿 <span className="text-white/25">{verComoGanhar ? "▴" : "▾"}</span>
            </button>

            {verComoGanhar && (
              <div className="mb-3 space-y-1.5">
                {produtos === null ? (
                  <p className="text-[11px] text-white/30">Carregando…</p>
                ) : (
                  <>
                    {produtos.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-[11px]">
                        <span className="flex-1 min-w-0 truncate text-white/60">{p.name}</span>
                        <span className="text-white/30">R$ {p.price.toFixed(2).replace(".", ",")}</span>
                        <span className="font-bold text-fuchsia-300 w-7 text-right">+{p.loyalty_discos}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-[11px] pt-1 border-t border-white/5">
                      <span className="flex-1 min-w-0 truncate text-white/60">Indicar um amigo que compra</span>
                      <span className="font-bold text-fuchsia-300 w-7 text-right">+2</span>
                    </div>
                  </>
                )}
              </div>
            )}

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
