"use client"

import { useCatalogo, mesclar, agruparUnificadaPorOcasiao, agruparUnificadaPorEstilo, type Filtro } from "./CatalogoContext"
import type { LibraryTrack } from "./MinhasMusicas"
import { combina } from "@/lib/busca"

// Pílulas de ocasião e estilo, agora logo abaixo da busca.
//
// Antes viviam dentro do cartão "Rede Fiz Música", no meio da tela. Subiram
// porque fazem a mesma coisa que a busca — reduzir o que você está vendo — e
// separá-las era pedir pra pessoa procurar num lugar e filtrar noutro.
//
// Isso só ficou possível depois dos dois modos (a0c68ae): enquanto os filtros
// só mexiam na raia da Rede, colocá-los acima de "Minha Playlist" seria
// mentira visual — a pessoa clicaria em "Rock" e a playlist logo abaixo
// continuaria intacta. Agora filtro ativo entra em modo resultado, igual à
// busca, e o que está na tela é de fato só o que passou pelo filtro.
export default function FiltrosMusica({
  busca,
  filtro,
  onFiltro,
  minhas = [],
}: {
  busca: string
  filtro: Filtro
  onFiltro: (f: Filtro) => void
  minhas?: LibraryTrack[]
}) {
  const { items } = useCatalogo()

  // As pílulas contam sobre o que a BUSCA já deixou passar: se você digitou
  // "natal" e sobraram 3 músicas, as pílulas refletem essas 3 — não o catálogo
  // inteiro. Senão a pílula prometeria 16 e a lista entregaria 2.
  //
  // Conta sobre suas músicas + Rede, a MESMA lista que o resultado monta
  // (mesclar). Antes contava só a Rede: a pílula dizia "🎤 Sertanejo · 6" e a
  // lista abria com 9, porque as do próprio cliente entravam lá e não aqui.
  const base = mesclar(minhas, items, null)
    .filter((it) => combina(busca, [it.title, it.occasion, it.musicalStyle]))

  const ocasioes = [...agruparUnificadaPorOcasiao(base).entries()].sort((a, b) => b[1].length - a[1].length)
  const estilos  = [...agruparUnificadaPorEstilo(base).entries()].sort((a, b) => b[1].length - a[1].length)

  if (base.length === 0) return null

  return (
    <div className="mb-6">
      <Linha titulo="Por ocasião">
        <Pill ativa={filtro === null} onClick={() => onFiltro(null)}>Todas · {base.length}</Pill>
        {ocasioes.map(([valor, lista]) => (
          <Pill
            key={valor}
            ativa={filtro?.tipo === "ocasiao" && filtro.valor === valor}
            onClick={() => onFiltro({ tipo: "ocasiao", valor })}
          >
            {valor} · {lista.length}
          </Pill>
        ))}
      </Linha>

      {estilos.length > 0 && (
        <Linha titulo="Por estilo">
          {estilos.map(([valor, lista]) => (
            <Pill
              key={valor}
              ativa={filtro?.tipo === "estilo" && filtro.valor === valor}
              onClick={() => onFiltro({ tipo: "estilo", valor })}
            >
              {valor} · {lista.length}
            </Pill>
          ))}
        </Linha>
      )}
    </div>
  )
}

function Linha({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <>
      <p className="text-[10px] uppercase tracking-wide font-bold text-white/30 mb-2">{titulo}</p>
      {/* Sangra até a borda no celular pra rolagem horizontal não parecer
          cortada no meio do padding da página. */}
      <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-x-visible pb-2 mb-2 -mx-5 sm:mx-0 px-5 sm:px-0">
        {children}
      </div>
    </>
  )
}

function Pill({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-[1.04] active:scale-95 ${
        ativa ? "border-transparent text-white shadow-[0_4px_16px_-2px_rgba(217,70,239,0.55)]" : "border-white/10 bg-white/[0.04] text-white/55 hover:text-white/85 hover:border-white/20"
      }`}
      style={ativa ? { background: "linear-gradient(135deg, #f0196b, #d946ef)" } : undefined}
    >
      {children}
    </button>
  )
}
