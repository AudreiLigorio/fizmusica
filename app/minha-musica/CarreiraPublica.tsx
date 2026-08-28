"use client"

import { useEffect, useState } from "react"

// A explicação do programa pra quem ainda não tem conta.
//
// Regra que vale pra tudo aqui: só entra o que o motor REALMENTE credita
// hoje (lib/fidelidade.ts) — compra digital 1 💿, plano com item físico 2 💿,
// indicação que vira compra 2 💿. Ouvir música, lembretes de data e "interagir"
// não geram disco nenhum ainda; prometer isso numa tela pública viraria
// promessa quebrada com cliente de verdade. Quando o motor ganhar novas
// formas de crédito, elas entram na lista COMO_GANHAR e aparecem sozinhas.

type Nivel = {
  id: number
  icone: string
  nome: string
  minDiscos: number
  descontoDigital: number
  artePrefixo: string | null
}

// Cada degrau ganha mais presença que o anterior: é a evolução acontecendo na
// própria página, não só descrita no texto.
const DEGRAU = [
  { avatar: "w-16", brilho: "none",                                        anel: "rgba(255,255,255,0.06)" },
  { avatar: "w-20", brilho: "drop-shadow(0 6px 18px rgba(240,25,107,0.20))", anel: "rgba(240,25,107,0.18)" },
  { avatar: "w-24", brilho: "drop-shadow(0 8px 22px rgba(217,70,239,0.28))", anel: "rgba(217,70,239,0.28)" },
  { avatar: "w-28", brilho: "drop-shadow(0 10px 26px rgba(217,70,239,0.38))", anel: "rgba(217,70,239,0.40)" },
  { avatar: "w-32", brilho: "drop-shadow(0 14px 34px rgba(240,25,107,0.55))", anel: "rgba(240,25,107,0.60)" },
]

const COMO_GANHAR = [
  { icone: "🎵", discos: 1, titulo: "Cada música que você cria", texto: "Toda música digital entregue rende um disco." },
  { icone: "📦", discos: 2, titulo: "Planos com item físico", texto: "Quando o presente também chega na casa da pessoa." },
  { icone: "💌", discos: 2, titulo: "Indicar um amigo", texto: "Você ganha quando ele cria a música dele pelo seu link." },
]

export default function CarreiraPublica({ onEntrar }: { onEntrar: () => void }) {
  const [trilha, setTrilha] = useState<Nivel[] | null>(null)
  // O cliente escolhe o personagem quando entra — deixar a escolha aqui já
  // mostra que ela existe, e dá o que fazer numa tela que só se lê.
  const [personagem, setPersonagem] = useState<"f" | "m">("f")

  useEffect(() => {
    fetch("/api/carreira")
      .then((r) => r.json())
      .then((d) => setTrilha(d.trilha ?? []))
      .catch(() => setTrilha([]))
  }, [])

  const topo = trilha?.[trilha.length - 1]

  return (
    <div className="pb-4">
      {/* ── Abertura ───────────────────────────────────────────────── */}
      <div className="text-center pt-2 pb-9">
        <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-fuchsia-300/80 mb-3">
          Programa de fidelidade
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-[1.05]">
          Sua carreira<br />
          <span className="bg-gradient-to-r from-pink-400 to-fuchsia-500 bg-clip-text text-transparent">
            de cantor
          </span>
        </h1>
        <p className="text-white/55 text-[15px] leading-relaxed max-w-[19rem] mx-auto">
          Ninguém começa famoso. Você começa de pantufa, cantando no chuveiro.
          A cada música que você cria pra alguém, seu personagem ganha um palco
          maior — e você paga menos na próxima.
        </p>
      </div>

      {/* ── Do pijama ao palco: a promessa em uma imagem ───────────── */}
      {topo?.artePrefixo && (
        <div className="relative mb-10">
          <div
            className="absolute inset-x-0 bottom-0 h-32 blur-2xl -z-10"
            style={{ background: "radial-gradient(60% 100% at 78% 100%, rgba(217,70,239,0.35), transparent 70%)" }}
          />
          <div className="flex items-end justify-center gap-1">
            <img src={`/carreira/nivel-1-${personagem}.webp`} alt="Cantor de chuveiro" className="w-20 h-auto opacity-45" />
            <div className="flex-1 max-w-[70px] pb-8 flex items-center gap-1">
              <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-fuchsia-400/60" />
              <span className="text-fuchsia-300 text-lg leading-none">›</span>
            </div>
            <img
              src={`/carreira/${topo.artePrefixo}-${personagem}.webp`}
              alt="Popstar"
              className="w-36 h-auto"
              style={{ filter: "drop-shadow(0 14px 34px rgba(240,25,107,0.55))" }}
            />
          </div>

          {/* Escolha do personagem — é feature real da conta, não enfeite. */}
          <div className="flex items-center justify-center gap-2 mt-5">
            <span className="text-[11px] text-white/35 mr-1">Seu personagem:</span>
            {(["f", "m"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPersonagem(p)}
                aria-label={p === "f" ? "Personagem feminino" : "Personagem masculino"}
                className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-all ${
                  personagem === p ? "border-pink-400 scale-105" : "border-white/10 opacity-45 hover:opacity-75"
                }`}
              >
                <img src={`/carreira/nivel-5-${p}.webp`} alt="" className="w-full h-full object-cover object-top" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── A trilha ───────────────────────────────────────────────── */}
      <div className="max-w-md mx-auto mb-5 text-center">
        <h2 className="text-xl font-bold">Cinco degraus até o topo</h2>
        {/* Nada de "nunca desce": estorno de pedido reverte discos (REFUND em
            lib/fidelidade.ts) e o nível pode cair junto. O que é verdade — e
            vende igual — é que o desconto entra sozinho. */}
        <p className="text-white/40 text-xs mt-1">
          O desconto entra sozinho no seu próximo pedido. Sem cupom, sem código.
        </p>
      </div>

      {trilha === null ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="relative max-w-md mx-auto">
          {/* Sem fio ligando os degraus: os cartões são translúcidos, então a
              linha aparecia POR CIMA deles em vez de atrás. O caminho já se lê
              no avatar crescendo e na borda acendendo a cada nível. */}
          <div className="space-y-3">
            {trilha.map((n, i) => {
              const d = DEGRAU[Math.min(i, DEGRAU.length - 1)]
              const arte = n.artePrefixo ? `/carreira/${n.artePrefixo}-${personagem}.webp` : null
              return (
                <div
                  key={n.id}
                  className="relative flex items-center gap-4 rounded-3xl pl-3 pr-5 py-3"
                  style={{
                    background: `linear-gradient(100deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))`,
                    border: `1px solid ${d.anel}`,
                  }}
                >
                  <div className="w-[74px] shrink-0 flex justify-center">
                    {arte ? (
                      <img src={arte} alt={n.nome} className={`${d.avatar} h-auto`} style={{ filter: d.brilho }} />
                    ) : (
                      <span className="text-3xl">{n.icone}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 py-1">
                    <p className="font-bold text-[17px] leading-tight">{n.nome}</p>
                    <p className="text-xs text-white/40 mt-1">
                      {n.minDiscos === 0 ? "Todo mundo começa aqui" : `${n.minDiscos} discos`}
                    </p>
                  </div>

                  {n.descontoDigital > 0 ? (
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-bold leading-none bg-gradient-to-r from-pink-400 to-fuchsia-400 bg-clip-text text-transparent">
                        {n.descontoDigital}%
                      </p>
                      <p className="text-[10px] text-white/35 mt-0.5">de desconto</p>
                    </div>
                  ) : (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/25 font-bold">Início</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Como ganhar discos ─────────────────────────────────────── */}
      <div className="max-w-md mx-auto mt-12">
        <h2 className="text-xl font-bold mb-1">Como se ganha um 💿</h2>
        <p className="text-white/40 text-xs mb-5">
          Cada disco é uma história que virou música. Eles ficam na sua conta e não expiram.
        </p>

        <div className="space-y-2.5">
          {COMO_GANHAR.map((c) => (
            <div key={c.titulo} className="flex items-start gap-3.5 bg-white/[0.03] rounded-2xl px-4 py-3.5">
              <span className="text-xl leading-none mt-0.5">{c.icone}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{c.titulo}</p>
                <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{c.texto}</p>
              </div>
              <span className="shrink-0 text-sm font-bold text-fuchsia-300 mt-0.5">+{c.discos}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Fecho ──────────────────────────────────────────────────── */}
      <div className="text-center mt-12">
        <button
          onClick={onEntrar}
          className="px-8 py-3.5 rounded-full font-semibold text-white text-[15px] transition-transform hover:scale-[1.03] active:scale-95"
          style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 8px 28px -6px rgba(240,25,107,0.6)" }}
        >
          Começar minha carreira
        </button>
        <p className="text-white/40 text-xs mt-3.5 max-w-[17rem] mx-auto leading-relaxed">
          Criar a conta é grátis. A primeira música que você fizer já te tira
          do chuveiro.
        </p>
      </div>
    </div>
  )
}
