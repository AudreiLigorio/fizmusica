"use client"

import { useEffect } from "react"
import BuscaMusicas from "./BuscaMusicas"
import FiltrosMusica from "./FiltrosMusica"
import ResultadosBusca from "./ResultadosBusca"
import RedeFizMusica from "./RedeFizMusica"
import FaixaCarreira from "./FaixaCarreira"
import { useCatalogo, casaFiltroCliente } from "./CatalogoContext"
import { combina } from "@/lib/busca"
import type { LibraryTrack } from "./MinhasMusicas"

// A aba Músicas, compartilhada pela área logada e pela visão do visitante.
//
// Existe como componente próprio porque busca e filtro agora vivem no
// CatalogoContext (viraram parâmetros de consulta ao servidor, desde a
// paginação), e quem MONTA o provider não pode consumi-lo no mesmo render —
// precisa ser um filho.
//
// Dois modos, como no Spotify: buscando ou filtrando, as seções somem e vira
// uma lista única de resultados; sem nada disso, a tela é de navegação. Antes
// a busca filtrava as raias no lugar, e o resultado ficava espalhado entre
// duas seções, no meio dos títulos e bordas delas.
export default function AbaMusicas({
  minhas = [],
  meuApelido = null,
  onPlaylistsChanged,
  onPrecisaLogin,
  onModoResultado,
  onAbrirCarreira,
  children,
}: {
  minhas?: LibraryTrack[]
  meuApelido?: string | null
  onPlaylistsChanged?: () => void
  onPrecisaLogin?: () => void
  // Avisa a página quando entra/sai do modo resultado. Painéis que vivem
  // FORA da aba (indicação, datas) precisam saber disso pra sumir durante a
  // busca — eles não podem ser filhos daqui, senão remontariam a cada troca
  // de aba e refariam as consultas.
  onModoResultado?: (v: boolean) => void
  // Abre a aba Carreira. Vem de cima porque quem controla as abas é a página.
  onAbrirCarreira?: () => void
  // O que vem DEPOIS da Rede no modo navegação — é a única parte que muda
  // entre as duas telas (biblioteca do cliente x convite pra criar conta).
  children?: React.ReactNode
}) {
  const { busca, setBusca, filtro, total } = useCatalogo()

  const modoResultado = !!busca.trim() || !!filtro
  useEffect(() => { onModoResultado?.(modoResultado) }, [modoResultado, onModoResultado])

  // Só as SUAS músicas que casam com a busca/filtro — somar todas daria um
  // número maior que o de linhas na tela (a Rede já vem filtrada do
  // servidor). É o mesmo erro de "a pílula promete 6 e a lista entrega 9"
  // que já foi corrigido uma vez em 78faf4d.
  const minhasNoResultado = minhas.filter(
    (t) => t.audioUrl
      && casaFiltroCliente(t.occasion, t.musicalStyle, filtro)
      && combina(busca, [t.title, t.occasion, t.musicalStyle]),
  ).length

  return (
    <>
      <BuscaMusicas
        valor={busca}
        onValor={setBusca}
        resultados={modoResultado ? total + minhasNoResultado : null}
      />

      {/* Pílulas logo abaixo da busca: filtrar e buscar são a mesma ação
          (reduzir o que está na tela), então moram juntos. */}
      <FiltrosMusica minhas={minhas} />

      {modoResultado ? (
        <ResultadosBusca minhas={minhas} meuApelido={meuApelido} />
      ) : (
        <>
          {/* Faixa de carreira ANTES da Rede: é a primeira coisa da aba,
              onde ela cumpre o papel de mostrar que existe uma progressão.
              Só aparece pra quem tem conta — ela some sozinha se a API não
              devolver carreira. */}
          {onAbrirCarreira && <FaixaCarreira onAbrirCarreira={onAbrirCarreira} />}

          {/* Rede primeiro (pedido do Audrei): descoberta puxa mais que a
              própria biblioteca, que já é o conteúdo principal da aba
              Pedidos. Mesma ordem nas duas telas. */}
          <RedeFizMusica onPlaylistsChanged={onPlaylistsChanged} onPrecisaLogin={onPrecisaLogin} />
          {children}
        </>
      )}
    </>
  )
}
