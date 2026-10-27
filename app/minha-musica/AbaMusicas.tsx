"use client"

import { useEffect, useState } from "react"
import BuscaMusicas from "./BuscaMusicas"
import FiltrosMusica from "./FiltrosMusica"
import ResultadosBusca from "./ResultadosBusca"
import RedeFizMusica from "./RedeFizMusica"
import FaixaCarreira from "./FaixaCarreira"
import InfoTooltip from "./InfoTooltip"
import ResumeMusicBanner from "@/app/components/ResumeMusicBanner"
import { useNoAppPlay } from "@/lib/canal"
import { useCatalogo, casaFiltroCliente } from "./CatalogoContext"
import { combina } from "@/lib/busca"
import { rotuloDoRitmo } from "@/lib/ritmo"
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
  const { busca, setBusca, filtro, setFiltro, total } = useCatalogo()
  const noApp = useNoAppPlay() === true

  // "Ver todos os ritmos" mora AQUI, não dentro da Rede: entrar num ritmo
  // desmonta a Rede (a tela vira lista de resultados), então o mural voltava
  // recolhido no Voltar — e quem tinha aberto justamente pra alcançar um
  // ritmo da cauda precisava abrir de novo a cada ida e volta. Este
  // componente fica montado nos dois modos.
  const [muralAberto, setMuralAberto] = useState(false)

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
      {/* App: quem saiu do wizard no meio cai aqui — o lembrete da música
          salva fica no topo, antes de tudo. */}
      {noApp && !modoResultado && <ResumeMusicBanner formato="cartao" />}

      {/* Título da aba no TOPO, acima da busca (pedido do Audrei,
          2026-10-10): quem chega já lê onde está antes do campo. Ficava no
          meio da tela, abaixo da busca e das pílulas.
          A contagem só aparece fora da busca: buscando, o número de
          resultados já vem no próprio campo — dois números confundiriam. */}
      <div className="mb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <h2 className="text-xl font-bold flex-1 min-w-0 truncate">SpotFiz</h2>
          <InfoTooltip text="Ouça músicas de outros usuários, aplauda as que emocionam, favorite e monte suas playlists." />
        </div>
        {/* Sem o total de músicas por enquanto (Audrei, 2026-10-10). */}
        <p className="text-sm text-white/50">Escute músicas publicadas por outros usuários</p>
      </div>

      <BuscaMusicas
        valor={busca}
        onValor={setBusca}
        resultados={modoResultado ? total + minhasNoResultado : null}
      />

      {/* Pílulas logo abaixo da busca: filtrar e buscar são a mesma ação
          (reduzir o que está na tela), então moram juntos. */}
      <FiltrosMusica minhas={minhas} />

      {/* Cabeçalho do recorte ativo.
          Nasceu junto com a saída da fileira "Por estilo": a pílula acesa era
          o ÚNICO lugar que dizia em que ritmo a pessoa estava e o único jeito
          de sair dele sem o botão Voltar. Tirar a fileira sem repor isto
          deixaria quem entra pelo mural numa lista sem nome e sem porta.
          Só para filtro — a busca já mostra a contagem dentro do campo. */}
      {modoResultado && filtro && (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setFiltro(null)}
            aria-label={filtro.tipo === "estilo" ? "Voltar para todos os ritmos" : "Limpar o filtro de ocasião"}
            className="shrink-0 w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-lg text-white/70 hover:text-white hover:border-white/35 transition-colors"
          >
            ‹
          </button>
          <div className="min-w-0">
            <p className="text-base font-bold truncate">
              {filtro.tipo === "estilo" ? rotuloDoRitmo(filtro.valor) : filtro.valor}
            </p>
            <p className="text-[13px] text-white/45">
              {total + minhasNoResultado} {total + minhasNoResultado === 1 ? "música" : "músicas"}
            </p>
          </div>
        </div>
      )}

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
          <RedeFizMusica
            onPlaylistsChanged={onPlaylistsChanged}
            onPrecisaLogin={onPrecisaLogin}
            muralAberto={muralAberto}
            onMuralAberto={setMuralAberto}
          />
          {children}
        </>
      )}
    </>
  )
}
