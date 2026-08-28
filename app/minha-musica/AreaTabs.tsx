"use client"

import { useEffect } from "react"
import { usePlayer } from "./PlayerContext"

// Navegação da área do cliente. Ícones desenhados aqui mesmo (traço único,
// grade de 24) em vez de emoji: emoji vem da fonte do sistema, tem peso
// diferente em cada aparelho e não aceita cor de estado — a aba ativa precisa
// ficar branca e as outras apagadas.
// "home" não é seção da área do cliente — é a landing. Entra aqui porque
// divide a mesma barra, e é o que dá caminho de volta pra quem foi parar na
// Rede e quer entender o produto.
export type Aba = "home" | "pedidos" | "musicas" | "carreira"

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" aria-hidden="true" {...S}>
      <path d="M3 10.2 12 3l9 7.2" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  )
}
function IconPedidos() {
  return (
    <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" aria-hidden="true" {...S}>
      <path d="m7.5 4.3 9 5.1" />
      <path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}
function IconMusicas() {
  return (
    <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" aria-hidden="true" {...S}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}
// Medalha: a aba é a página de artista do cliente (nível, discos), não um
// cadastro — por isso não é o ícone de pessoa.
function IconCarreira() {
  return (
    <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" aria-hidden="true" {...S}>
      <circle cx="12" cy="9" r="6" />
      <path d="M8.2 14.3 7 22l5-3 5 3-1.2-7.7" />
    </svg>
  )
}
function IconCriar() {
  return (
    <svg viewBox="0 0 24 24" className="w-[19px] h-[19px]" aria-hidden="true" {...S} strokeWidth={2}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

const ABAS: { id: Aba; label: string; Icon: () => React.JSX.Element }[] = [
  { id: "home", label: "Home", Icon: IconHome },
  { id: "pedidos", label: "Pedidos", Icon: IconPedidos },
  { id: "musicas", label: "Músicas", Icon: IconMusicas },
  { id: "carreira", label: "Carreira", Icon: IconCarreira },
]

// Barra do rodapé — só no celular. Fica abaixo do mini player (que se desloca
// pra cima quando ela existe).
export function TabBarMobile({
  aba,
  onAba,
  onCriar,
}: {
  // null = nenhuma aba ativa — a barra agora também vive em páginas fora da
  // área do cliente (Quem somos, Contato, migração 2026-08-28) que não têm
  // aba correspondente nas 4 opções. Marcar uma delas como ativa ali seria
  // mentir sobre onde a pessoa está.
  aba: Aba | null
  onAba: (a: Aba) => void
  onCriar: () => void
}) {
  // O ::after estende a cor da barra pra baixo. No Safari/Chrome do celular, a
  // barra de endereço encolhe ao rolar e o `fixed` não acompanha na hora —
  // abre uma fresta onde o conteúdo aparecia POR BAIXO do menu. Assim a fresta
  // mostra a cor da barra em vez da página. Fica fora da tela quando não há
  // folga, então não custa nada no caso normal.
  return (
    <nav
      aria-label="Seções da sua área"
      className="sm:hidden fixed left-0 right-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 px-1 pt-2
                 after:content-[''] after:absolute after:left-0 after:right-0 after:top-full after:h-32 after:bg-[#130e1c]"
      style={{ background: "#130e1c", paddingBottom: "calc(0.6rem + env(safe-area-inset-bottom))" }}
    >
      <TabBtn {...ABAS[0]} ativa={aba === ABAS[0].id} onClick={() => onAba(ABAS[0].id)} />
      <TabBtn {...ABAS[1]} ativa={aba === ABAS[1].id} onClick={() => onAba(ABAS[1].id)} />

      {/* "Criar" não é aba, é atalho pra outro fluxo — por isso o tratamento
          visual diferente, senão o cliente estranha o menu sumir lá dentro. */}
      <button onClick={onCriar} className="flex flex-col items-center gap-1 text-[9px] font-medium text-white/40 hover:text-white/70 transition-colors">
        <span
          className="w-[34px] h-[34px] -mt-1 rounded-[11px] flex items-center justify-center text-white"
          style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)", boxShadow: "0 3px 12px rgba(240,25,107,.45)" }}
        >
          <IconCriar />
        </span>
        Criar
      </button>

      <TabBtn {...ABAS[2]} ativa={aba === ABAS[2].id} onClick={() => onAba(ABAS[2].id)} />
      <TabBtn {...ABAS[3]} ativa={aba === ABAS[3].id} onClick={() => onAba(ABAS[3].id)} />
    </nav>
  )
}

function TabBtn({ label, Icon, ativa, onClick }: { label: string; Icon: () => React.JSX.Element; ativa: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={ativa ? "page" : undefined}
      className={`flex flex-col items-center gap-1 text-[9px] font-medium transition-colors ${ativa ? "text-white" : "text-white/40 hover:text-white/70"}`}
    >
      <Icon />
      {label}
    </button>
  )
}

// No desktop as abas viram uma linha no topo da própria página. Não entram no
// <Header> global porque ele é compartilhado com o site inteiro — e uma barra
// lateral criaria uma segunda navegação competindo com a logo.
export function TabsDesktop({ aba, onAba, onCriar }: { aba: Aba; onAba: (a: Aba) => void; onCriar: () => void }) {
  return (
    <nav aria-label="Seções da sua área" className="hidden sm:flex items-center gap-1 border-b border-white/10 mb-6">
      {ABAS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onAba(id)}
          aria-current={aba === id ? "page" : undefined}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
            aba === id ? "text-white border-fuchsia-500" : "text-white/45 border-transparent hover:text-white/80"
          }`}
        >
          <Icon />
          {label}
        </button>
      ))}
      <button
        onClick={onCriar}
        className="ml-auto mb-2 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white transition-all hover:brightness-110"
        style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)" }}
      >
        <IconCriar />
        Criar música
      </button>
    </nav>
  )
}

// Fecha o player ao sair de "Músicas". Fica como componente próprio, e não
// dentro do irPara(), porque a aba também muda pelo endereço e pelo botão
// Voltar do navegador — reagir ao valor cobre os três caminhos de uma vez.
//
// Precisa ser filho do PlayerProvider (quem renderiza o provider não enxerga
// o contexto dele), por isso mora aqui e é montado junto do MiniPlayer.
export function FecharPlayerForaDeMusicas({ aba }: { aba: Aba }) {
  const { close } = usePlayer()
  useEffect(() => {
    if (aba !== "musicas") close()
  }, [aba, close])
  return null
}
