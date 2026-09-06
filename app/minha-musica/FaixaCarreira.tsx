"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

// Faixa de carreira no topo da Rede Fiz Música.
//
// Ideia do Audrei: mostrar o personagem e quantos discos faltam pro próximo
// nível bem onde a pessoa passa tempo, pra que ela entenda que existe uma
// carreira a seguir. Clicar leva pra aba Carreira, onde estão os detalhes.
//
// FAIXA, não card: a Rede já tem busca, filtros e o Top 10 acima da dobra —
// acabamos de cortar a grade pra playlist voltar a ser alcançável. Um bloco
// alto aqui desfaria isso. Por isso ~64px de altura e uma linha só.
//
// Três estados, porque a mesma informação não serve pros três:
//   - subindo   → barra + "faltam N discos"
//   - no topo   → sem barra; celebra e mostra o benefício que ele já tem
//   - sem conta → nada. A faixa é sobre O PROGRESSO DELE; pra quem não tem
//                 conta ela seria uma promessa vazia, e a tela já tem CTA.

type Nivel = { nome: string; artePrefixo: string | null; descontoDigital: number }
type Carreira = {
  discos: number
  nivel: Nivel
  proximo: Nivel | null
  faltam: number
  progresso: number
  personagem: "m" | "f" | null
}

export default function FaixaCarreira({ onAbrirCarreira }: { onAbrirCarreira: () => void }) {
  const [c, setC] = useState<Carreira | null>(null)

  useEffect(() => {
    let vivo = true
    // O token É obrigatório: /api/carreira identifica o cliente pelo header
    // Authorization, e SEM ele devolve a resposta pública (trilha dos níveis,
    // sem `nivel`). A primeira versão desta faixa chamava sem token, então
    // ela nunca aparecia — nem logado. Falhava em silêncio, porque a
    // resposta era 200 e o componente só via que faltava `nivel`.
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const d = await fetch("/api/carreira", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then((r) => (r.ok ? r.json() : null))
        if (vivo && d?.nivel) setC(d)
      } catch { /* sem carreira, a faixa simplesmente não aparece */ }
    })()
    return () => { vivo = false }
  }, [])

  if (!c?.nivel) return null

  const arte = c.nivel.artePrefixo ? `/carreira/${c.nivel.artePrefixo}-${c.personagem ?? "f"}.webp` : null
  const noTopo = !c.proximo

  return (
    <button
      onClick={onAbrirCarreira}
      className="w-full mb-4 flex items-center gap-3 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] px-3 py-2.5 text-left hover:border-fuchsia-400/40 hover:bg-fuchsia-500/[0.10] transition-colors group"
    >
      {/* Personagem: pequeno aqui de propósito. Ele é o herói na aba
          Carreira; nesta faixa é a isca visual, não a atração. */}
      {arte && (
        <img src={arte} alt="" aria-hidden="true"
             className="w-11 h-11 rounded-xl object-cover object-top shrink-0 bg-black/30" />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider font-bold text-white/35 leading-none mb-1">
          Sua carreira
        </p>
        <p className="text-sm font-extrabold text-white/90 truncate leading-tight">{c.nivel.nome}</p>

        {noTopo ? (
          <p className="text-[11px] text-fuchsia-300/80 mt-0.5 truncate">
            Nível máximo · {c.nivel.descontoDigital}% de desconto nas próximas
          </p>
        ) : (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden max-w-[220px]">
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${Math.round(c.progresso * 100)}%`, background: "linear-gradient(90deg,#f0196b,#d946ef)" }} />
            </div>
            <p className="text-[11px] text-white/50 whitespace-nowrap">
              faltam <strong className="text-fuchsia-300">{c.faltam}</strong> {c.faltam === 1 ? "disco" : "discos"}
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 text-right hidden sm:block">
        {!noTopo && (
          <p className="text-[11px] text-white/40 leading-tight">
            próximo nível<br />
            <strong className="text-white/70">{c.proximo!.nome}</strong>
          </p>
        )}
      </div>

      <span className="shrink-0 text-white/30 group-hover:text-fuchsia-300 transition-colors">›</span>
    </button>
  )
}
