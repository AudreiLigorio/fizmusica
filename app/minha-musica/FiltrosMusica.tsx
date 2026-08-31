"use client"

import { useState } from "react"
import { useCatalogo } from "./CatalogoContext"
import type { LibraryTrack } from "./MinhasMusicas"
import { combina } from "@/lib/busca"

// Pílulas de ocasião e estilo, logo abaixo da busca.
//
// Antes viviam dentro do cartão "Rede Fiz Música", no meio da tela. Subiram
// porque fazem a mesma coisa que a busca — reduzir o que você está vendo — e
// separá-las era pedir pra pessoa procurar num lugar e filtrar noutro.
//
// As contagens vêm do SERVIDOR (facetas). Com a paginação o cliente só tem
// uma página do catálogo, então contar na tela diria "Rock · 12" quando o
// catálogo tem 300 — a pílula prometeria um número e a lista entregaria
// outro, erro que já aconteceu uma vez (ver 78faf4d). Às facetas somam-se as
// músicas do próprio cliente, que a Rede não conhece.
export default function FiltrosMusica({ minhas = [] }: { minhas?: LibraryTrack[] }) {
  const { facetas, filtro, setFiltro, busca, total } = useCatalogo()

  // As do cliente são poucas e estão todas carregadas — contar na tela aqui
  // não custa nada, e sem isso a pílula ignoraria a biblioteca dele.
  const minhasNaBusca = minhas.filter((t) => t.audioUrl && combina(busca, [t.title, t.occasion, t.musicalStyle]))

  const somar = (base: [string, number][], chave: (t: LibraryTrack) => string[]) => {
    const m = new Map(base)
    for (const t of minhasNaBusca) {
      for (const k of chave(t)) m.set(k, (m.get(k) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }

  const ocasioes = somar(facetas.ocasioes, (t) => [t.occasion])
  const estilos = somar(facetas.estilos, (t) =>
    (t.musicalStyle ?? "").split(",").map((s) => s.trim()).filter(Boolean))

  const totalGeral = total + minhasNaBusca.length

  if (ocasioes.length === 0) return null

  return (
    <div className="mb-6">
      <Linha
        titulo="Por ocasião"
        itens={[
          { chave: "__todas", label: `Todas · ${totalGeral}`, ativa: filtro === null, onClick: () => setFiltro(null) },
          ...ocasioes.map(([valor, n]) => ({
            chave: valor,
            label: `${valor} · ${n}`,
            ativa: filtro?.tipo === "ocasiao" && filtro.valor === valor,
            onClick: () => setFiltro({ tipo: "ocasiao" as const, valor }),
          })),
        ]}
      />

      {estilos.length > 0 && (
        <Linha
          titulo="Por estilo"
          itens={estilos.map(([valor, n]) => ({
            chave: valor,
            label: `${valor} · ${n}`,
            ativa: filtro?.tipo === "estilo" && filtro.valor === valor,
            onClick: () => setFiltro({ tipo: "estilo" as const, valor }),
          }))}
        />
      )}
    </div>
  )
}

// Quantas pílulas ficam à mostra no computador antes do "ver todos".
//
// Só no computador: lá as pílulas quebram em linha e as 37 do catálogo
// viravam seis fileiras — metade da tela era filtro antes de aparecer uma
// música. No celular elas correm numa faixa horizontal, ocupam uma linha só e
// nunca poluíram nada, então lá continuam todas ao alcance do dedo.
//
// 9 é o que cabe em duas fileiras num monitor comum. Passar disso não é
// escolher melhor: as pílulas vêm ordenadas por quantidade, e da décima em
// diante são ocasiões com uma ou duas músicas.
const VISIVEIS_NA_WEB = 9

type ItemFiltro = { chave: string; label: string; ativa: boolean; onClick: () => void }

function Linha({ titulo, itens }: { titulo: string; itens: ItemFiltro[] }) {
  const [expandido, setExpandido] = useState(false)
  const escondidas = Math.max(0, itens.length - VISIVEIS_NA_WEB)

  return (
    <>
      <p className="text-[10px] uppercase tracking-wide font-bold text-white/30 mb-2">{titulo}</p>
      {/* Sangra até a borda no celular pra rolagem horizontal não parecer
          cortada no meio do padding da página. */}
      <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-x-visible pb-2 mb-2 -mx-5 sm:mx-0 px-5 sm:px-0">
        {itens.map((it, i) => (
          <Pill
            key={it.chave}
            ativa={it.ativa}
            onClick={it.onClick}
            // `sm:hidden` some no computador e mantém no celular — some as
            // pílulas do fim sem tirá-las da rolagem horizontal. Cortar por
            // altura deixaria meia fileira aparecendo; aqui a quebra cai
            // sempre no fim de uma linha inteira. A ativa nunca some: filtro
            // escolhido que desaparece parece filtro que sumiu.
            className={!expandido && i >= VISIVEIS_NA_WEB && !it.ativa ? "sm:hidden" : ""}
          >
            {it.label}
          </Pill>
        ))}

        {escondidas > 0 && (
          <button
            onClick={() => setExpandido((v) => !v)}
            className="hidden sm:inline-flex shrink-0 items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-dashed border-white/15 text-white/45 hover:text-white/80 hover:border-white/30 transition-colors"
          >
            {expandido ? "Ver menos" : `Ver todos · +${escondidas}`}
            <svg viewBox="0 0 24 24" aria-hidden="true" className={`w-3 h-3 transition-transform ${expandido ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}
      </div>
    </>
  )
}

function Pill({ ativa, onClick, className = "", children }: { ativa: boolean; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`${className} shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-[1.04] active:scale-95 ${
        ativa ? "border-transparent text-white shadow-[0_4px_16px_-2px_rgba(217,70,239,0.55)]" : "border-white/10 bg-white/[0.04] text-white/55 hover:text-white/85 hover:border-white/20"
      }`}
      style={ativa ? { background: "linear-gradient(135deg, #f0196b, #d946ef)" } : undefined}
    >
      {children}
    </button>
  )
}
