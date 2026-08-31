"use client"

import { useEffect, useState } from "react"

// A explicação do programa pra quem ainda não tem conta.
//
// Regra que vale pra tudo aqui: só entra o que o motor REALMENTE credita
// hoje (lib/fidelidade.ts). Ouvir música, lembretes de data e "interagir"
// não geram disco nenhum ainda; prometer isso numa tela pública viraria
// promessa quebrada com cliente de verdade.
//
// A lista "como ganhar" por plano NÃO é mais texto fixo — cada produto tem
// seu próprio valor de disco (migração 055, editável em /admin/fidelidade),
// e não é só "digital vs físico": Retrospectiva, premium e Exclusivo já têm
// valores diferentes entre si. Escrever isso à mão de novo é o mesmo erro
// que gerou este pedido do Audrei ("não é só produto físico, tem
// retrospectiva e etc") — a tela buscava a REGRA antiga (1 fixo) só que em
// prosa. Agora busca /api/produtos, então quando o Audrei mexer nos valores
// no admin essa tela muda sozinha, sem precisar de mim de novo.

type Nivel = {
  id: number
  icone: string
  nome: string
  minDiscos: number
  descontoDigital: number
  artePrefixo: string | null
}

type Produto = {
  id: string
  name: string
  price: number
  loyalty_discos: number
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

// Indicação não é produto — não vem do /api/produtos, então continua fixa
// aqui. O valor (lib/fidelidade.ts, concederDiscoDeIndicacao) não é
// configurável no admin ainda; se um dia virar, esse número sai daqui.
const DISCOS_POR_INDICACAO = 2

export default function CarreiraPublica({ onEntrar }: { onEntrar: () => void }) {
  const [trilha, setTrilha] = useState<Nivel[] | null>(null)
  const [produtos, setProdutos] = useState<Produto[] | null>(null)
  // O cliente escolhe o personagem quando entra — deixar a escolha aqui já
  // mostra que ela existe, e dá o que fazer numa tela que só se lê.
  const [personagem, setPersonagem] = useState<"f" | "m">("f")

  useEffect(() => {
    fetch("/api/carreira")
      .then((r) => r.json())
      .then((d) => setTrilha(d.trilha ?? []))
      .catch(() => setTrilha([]))
    fetch("/api/produtos")
      .then((r) => r.json())
      .then((d) => setProdutos(
        [...(d.products ?? [])].sort((a: Produto, b: Produto) => a.price - b.price)
      ))
      .catch(() => setProdutos([]))
  }, [])

  const topo = trilha?.[trilha.length - 1]

  return (
    <div className="pb-4">
      {/* ── Abertura ───────────────────────────────────────────────── */}
      <div className="text-center pt-2 pb-9">
        {/* Rótulo no mesmo tamanho/traço do "Por ocasião" e "Por estilo" da
            aba Músicas (text-[10px] uppercase tracking-wide font-bold) —
            estava em 11px com tracking mais largo, sem motivo pra divergir. */}
        <p className="text-[10px] uppercase tracking-wide font-bold text-fuchsia-300/80 mb-3">
          Programa de fidelidade
        </p>
        {/* O h1 abaixo é a ÚNICA exceção à normalização: é o hero da página
            de venda que o Audrei pediu ("linda e vendável"), não um título de
            seção como os outros — não existe equivalente pra ele na aba
            Músicas. Encolher pra text-xl junto com o resto mataria o impacto
            que essa tela foi construída pra ter. */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 leading-[1.05]">
          Sua carreira<br />
          <span className="bg-gradient-to-r from-pink-400 to-fuchsia-500 bg-clip-text text-transparent">
            de cantor
          </span>
        </h1>
        <p className="text-white/55 text-[15px] sm:text-base leading-relaxed max-w-[19rem] sm:max-w-md mx-auto">
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
            <img src={`/carreira/nivel-1-${personagem}.webp`} alt="Cantor de chuveiro" className="w-20 sm:w-32 lg:w-40 h-auto opacity-45" />
            <div className="flex-1 max-w-[70px] sm:max-w-[160px] pb-8 flex items-center gap-1">
              <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-fuchsia-400/60" />
              <span className="text-fuchsia-300 text-lg leading-none">›</span>
            </div>
            <img
              src={`/carreira/${topo.artePrefixo}-${personagem}.webp`}
              alt="Popstar"
              className="w-36 sm:w-52 lg:w-64 h-auto"
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
      <div className="max-w-md sm:max-w-2xl mx-auto mb-5 text-center">
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
        <div className="relative max-w-md sm:max-w-2xl mx-auto">
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
                      <img src={arte} alt={n.nome} className={`${d.avatar} sm:scale-125 h-auto transition-transform`} style={{ filter: d.brilho }} />
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
      <div className="max-w-md sm:max-w-2xl mx-auto mt-12">
        <h2 className="text-xl font-bold mb-1">Como se ganha um 💿</h2>
        <p className="text-white/40 text-xs mb-5">
          Quanto maior o plano, mais discos de uma vez. Eles ficam na sua conta e não expiram.
        </p>

        {produtos === null ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2.5">
            {produtos.map((p) => (
              <div key={p.id} className="flex items-center gap-3.5 bg-white/[0.03] rounded-2xl px-4 py-3.5">
                <span className="text-xl leading-none">🎵</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{p.name}</p>
                  <p className="text-xs text-white/45 mt-0.5">
                    R$ {p.price.toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-fuchsia-300">+{p.loyalty_discos}</span>
              </div>
            ))}

            <div className="flex items-start gap-3.5 bg-white/[0.03] rounded-2xl px-4 py-3.5">
              <span className="text-xl leading-none mt-0.5">💌</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Indicar um amigo</p>
                <p className="text-xs text-white/45 mt-0.5 leading-relaxed">Você ganha quando ele cria a música dele pelo seu link.</p>
              </div>
              <span className="shrink-0 text-sm font-bold text-fuchsia-300 mt-0.5">+{DISCOS_POR_INDICACAO}</span>
            </div>
          </div>
        )}
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
        <p className="text-white/40 text-xs mt-3.5 max-w-[17rem] sm:max-w-sm mx-auto leading-relaxed">
          Criar a conta é grátis. A primeira música que você fizer já te tira
          do chuveiro.
        </p>
      </div>
    </div>
  )
}
