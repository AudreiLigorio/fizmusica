"use client"

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
      <Linha titulo="Por ocasião">
        <Pill ativa={filtro === null} onClick={() => setFiltro(null)}>Todas · {totalGeral}</Pill>
        {ocasioes.map(([valor, n]) => (
          <Pill
            key={valor}
            ativa={filtro?.tipo === "ocasiao" && filtro.valor === valor}
            onClick={() => setFiltro({ tipo: "ocasiao", valor })}
          >
            {valor} · {n}
          </Pill>
        ))}
      </Linha>

      {estilos.length > 0 && (
        <Linha titulo="Por estilo">
          {estilos.map(([valor, n]) => (
            <Pill
              key={valor}
              ativa={filtro?.tipo === "estilo" && filtro.valor === valor}
              onClick={() => setFiltro({ tipo: "estilo", valor })}
            >
              {valor} · {n}
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
