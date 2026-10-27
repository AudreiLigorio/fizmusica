"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { nomeDoRitmo, ritmosDa } from "@/lib/ritmo"

// O catálogo da Rede virou dado compartilhado da aba Músicas.
//
// Antes cada peça buscava o seu: RedeFizMusica tinha o fetch dentro, e quando
// a lista de resultados entrou (a0c68ae) ela fez outro igual. Agora os filtros
// também precisam da mesma lista, e seriam três chamadas iguais na mesma tela.
//
// Desde a paginação, este contexto também é quem MONTA A CONSULTA: busca e
// filtro viraram parâmetros mandados ao servidor, porque o cliente não recebe
// mais o catálogo inteiro e não teria como filtrar o que não carregou. As
// contagens das pílulas vêm junto, como facetas — contar na tela diria
// "Rock · 12" quando o catálogo tem 300.

export type CatalogItem = {
  orderId: string
  // Sem `slug` de propósito: a Rede não distribui mais o link /m/{slug},
  // que é a porta das fotos do cliente. Ver /api/catalog.
  title: string
  occasion: string
  musicalStyle: string | null
  imageUrl: string | null
  audioUrl: string
  // Opcionais: a listagem não manda letra (76% do payload). O player busca
  // em /api/catalog/letra quando vai tocar.
  lyrics?: string | null
  lyricsLrc?: string | null
  authorApelido: string | null
  // Reproduções contadas (migração 057). Zero em tudo enquanto ela não roda.
  plays?: number
  // Total acumulado de palmas (migração 061). A ORDEM do "Em alta" é outra
  // coisa — palmas por ouvinte na janela — e já vem pronta do servidor.
  palmas?: number
  favorited: boolean
  createdAt: string
  // Quando a música entrou na Rede — diferente de `createdAt`, que é quando o
  // pedido foi feito. Só a raia "Mais recentes" usa.
  publishedAt?: string | null
}

export type Filtro = { tipo: "ocasiao" | "estilo"; valor: string } | null

export type Facetas = {
  ocasioes: [string, number][]
  // Chave = nome do ritmo UNIFICADO, sem emoji (ver lib/ritmo.ts). Quem
  // exibir passa por `rotuloDoRitmo` pra pôr o emoji atual.
  estilos: [string, number][]
}

// Um banner do mural de ritmos. `capa` é a capa de uma música real do ritmo.
export type Ritmo = {
  nome: string
  rotulo: string
  cor: string
  total: number
  capa: string | null
}

type Ctx = {
  items: CatalogItem[] | null
  // Ranking da Rede inteira — não acompanha busca, filtro nem página, por
  // isso vive separado de `items`.
  top10: CatalogItem[]
  // Ordenada por palmas POR OUVINTE na janela de 30 dias — a ordem vem do
  // banco (migração 064), com piso de ouvintes e contas da casa fora.
  emAlta: CatalogItem[]
  // Últimas publicadas, UMA POR AUTOR (ver /api/catalog). Também é da Rede
  // inteira, então vive aqui junto dos outros dois.
  recentes: CatalogItem[]
  // Mural de ritmos — o índice do acervo que substituiu a grade embaralhada.
  ritmos: Ritmo[]
  total: number
  temMais: boolean
  // Total da BUSCA, sem o filtro de ocasião/estilo — é o que a pílula
  // "Todas" promete. Ver /api/catalog.
  totalDaBusca: number
  carregando: boolean
  facetas: Facetas
  busca: string
  filtro: Filtro
  setBusca: (v: string) => void
  setFiltro: (f: Filtro) => void
  carregarMais: () => void
  alternarFavorito: (orderId: string) => void
}

const VAZIO: Facetas = { ocasioes: [], estilos: [] }

const CatalogoCtx = createContext<Ctx>({
  items: null, top10: [], emAlta: [], recentes: [], ritmos: [], total: 0, totalDaBusca: 0, temMais: false, carregando: false, facetas: VAZIO,
  busca: "", filtro: null,
  setBusca: () => {}, setFiltro: () => {}, carregarMais: () => {}, alternarFavorito: () => {},
})

const POR_PAGINA = 40

// ── Filtro no endereço ───────────────────────────────────────────────────
//
// Entrar num ritmo pelo mural troca a tela inteira pela lista daquele ritmo.
// Enquanto isso era só estado de componente, o botão Voltar do Android — e o
// app é TWA, então é o botão de verdade do aparelho — não desfazia a entrada:
// saía da aba Músicas, ou do app. Pondo o filtro na URL, Voltar devolve o
// mural, e o link do ritmo passa a ser compartilhável de brinde.
function filtroDaUrl(): Filtro {
  if (typeof window === "undefined") return null
  const qs = new URLSearchParams(window.location.search)
  const estilo = qs.get("estilo")
  if (estilo) return { tipo: "estilo", valor: estilo }
  const ocasiao = qs.get("ocasiao")
  if (ocasiao) return { tipo: "ocasiao", valor: ocasiao }
  return null
}

export function CatalogoProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CatalogItem[] | null>(null)
  const [top10, setTop10] = useState<CatalogItem[]>([])
  const [emAlta, setEmAlta] = useState<CatalogItem[]>([])
  const [recentes, setRecentes] = useState<CatalogItem[]>([])
  const [ritmos, setRitmos] = useState<Ritmo[]>([])
  const [total, setTotal] = useState(0)
  const [temMais, setTemMais] = useState(false)
  const [totalDaBusca, setTotalDaBusca] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const [facetas, setFacetas] = useState<Facetas>(VAZIO)
  const [busca, setBusca] = useState("")
  // Nasce já lendo o endereço, não `null` seguido de correção: começar vazio
  // dispararia uma consulta do catálogo inteiro antes da consulta filtrada, a
  // cada link de ritmo aberto.
  const [filtro, setFiltro] = useState<Filtro>(filtroDaUrl)

  // Semente fixa por visita: o servidor embaralha com ela, então a ordem é a
  // mesma entre as páginas (sem repetir nem pular música) e muda na próxima
  // visita, mantendo a sensação de descoberta.
  const semente = useMemo(() => Math.floor(Math.random() * 2_000_000_000) + 1, [])

  // Descarta resposta de consulta antiga que chegou atrasada — digitar
  // rápido dispara várias, e a última a chegar pode não ser a última pedida.
  const consultaAtual = useRef(0)

  const buscar = useCallback(async (desde: number, b: string, f: Filtro) => {
    const id = ++consultaAtual.current
    setCarregando(true)
    const { data: { session } } = await supabase.auth.getSession()
    const p = new URLSearchParams({ semente: String(semente), limite: String(POR_PAGINA), desde: String(desde) })
    if (b.trim()) p.set("busca", b.trim())
    if (f?.tipo === "ocasiao") p.set("ocasiao", f.valor)
    if (f?.tipo === "estilo") p.set("estilo", f.valor)

    // Sem sessão o header vai vazio de propósito: /api/catalog responde a
    // anônimo também (Fase 2 da abertura ao visitante), só que cortado.
    const res = await fetch(`/api/catalog?${p}`, {
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    })
    const d = await res.json().catch(() => ({}))
    if (id !== consultaAtual.current) return // chegou tarde, já há consulta mais nova

    setItems((prev) => (desde === 0 ? (d.items ?? []) : [...(prev ?? []), ...(d.items ?? [])]))
    // Só na primeira página: o ranking é o mesmo em todas, e sobrescrever a
    // cada "mostrar mais" faria a lista piscar sem motivo.
    // Só na primeira página: as prateleiras e o mural são os mesmos em todas,
    // e o servidor os monta sobre o catálogo inteiro (não sobre a busca nem o
    // filtro), então nunca vêm recortados.
    if (desde === 0) {
      setTop10(d.top10 ?? []); setEmAlta(d.emAlta ?? []); setRecentes(d.recentes ?? []); setRitmos(d.ritmos ?? [])
    }
    setTotal(d.total ?? 0)
    setTotalDaBusca(d.totalDaBusca ?? d.total ?? 0)
    setTemMais(!!d.temMais)
    setFacetas(d.facetas ?? VAZIO)
    setCarregando(false)
  }, [semente])

  // Busca digitada espera 300ms antes de ir ao servidor — sem isso cada
  // tecla vira uma requisição.
  useEffect(() => {
    const t = setTimeout(() => { buscar(0, busca, filtro) }, busca ? 300 : 0)
    return () => clearTimeout(t)
  }, [busca, filtro, buscar])

  // Escolher um filtro é uma IDA: grava no endereço com pushState, não
  // replaceState. É de propósito diferente das abas (page.tsx), que usam
  // replaceState porque trocar de aba é estado de tela, não navegação.
  const aplicarFiltro = useCallback((f: Filtro) => {
    setFiltro(f)
    if (typeof window === "undefined") return
    const qs = new URLSearchParams(window.location.search)
    qs.delete("estilo")
    qs.delete("ocasiao")
    if (f?.tipo === "estilo") qs.set("estilo", f.valor)
    if (f?.tipo === "ocasiao") qs.set("ocasiao", f.valor)
    const destino = qs.toString() ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.pushState(null, "", destino)
    // Tela nova começa no topo — a lista do ritmo entra no lugar do mural, e
    // sem isto ela abriria na altura em que o dedo estava.
    window.scrollTo({ top: 0 })
  }, [])

  // Voltar/avançar do navegador (e o botão físico no app) mandam aqui. Mexe
  // só no estado: a URL já é a que o navegador restaurou, então empurrar de
  // novo criaria uma entrada a cada volta e prenderia a pessoa na tela.
  useEffect(() => {
    const aoVoltar = () => setFiltro(filtroDaUrl())
    window.addEventListener("popstate", aoVoltar)
    return () => window.removeEventListener("popstate", aoVoltar)
  }, [])

  const carregarMais = useCallback(() => {
    if (carregando || !temMais) return
    buscar(items?.length ?? 0, busca, filtro)
  }, [carregando, temMais, items?.length, busca, filtro, buscar])

  const alternarFavorito = useCallback((orderId: string) => {
    // Só alterna o estado visual — sem reordenar. Reordenar aqui brigaria
    // com a paginação: a ordem é do servidor, e mexer nela na tela faria a
    // próxima página chegar fora de lugar.
    setItems((prev) => prev?.map((it) => (it.orderId === orderId ? { ...it, favorited: !it.favorited } : it)) ?? prev)
  }, [])

  return (
    <CatalogoCtx.Provider value={{
      items, top10, emAlta, recentes, ritmos, total, totalDaBusca, temMais, carregando, facetas, busca, filtro,
      setBusca, setFiltro: aplicarFiltro, carregarMais, alternarFavorito,
    }}>
      {children}
    </CatalogoCtx.Provider>
  )
}

export function useCatalogo() {
  return useContext(CatalogoCtx)
}

// ── Lista unificada (suas músicas + Rede) ────────────────────────────────
//
// Existe pra que a CONTAGEM DA PÍLULA e a LISTA DE RESULTADOS saiam da mesma
// fonte. Sem isso a pílula contava só a Rede ("🎤 Sertanejo · 6") enquanto o
// resultado incluía também as músicas do próprio cliente — a tela prometia 6
// e entregava 9.

export type Unificada = {
  id: string
  title: string
  occasion: string
  musicalStyle: string | null
  imageUrl: string | null
  audioUrl: string
  // Nulas nas músicas da Rede (a listagem não manda letra) — o player busca
  // sob demanda ao tocar.
  lyrics: string | null
  lyricsLrc: string | null
  apelido: string | null
  minha: boolean
  // Tem endereço público na Rede. Viaja junto com a faixa até o player, que
  // usa isso pra decidir favoritar e compartilhar — antes ele procurava a
  // faixa na lista carregada, que é paginada, e os botões sumiam.
  publico: boolean
  // Já está nos favoritos. Só faz sentido nas músicas da Rede: as do próprio
  // cliente nem entram no catálogo, então não há o que favoritar.
  favorited: boolean
}

type TrackDoCliente = {
  // Vem de orders.publication_consent — a mesma trava que faz a música
  // aparecer na Rede e dá endereço público a ela.
  publico?: boolean
  id: string
  title: string
  occasion: string
  musicalStyle: string | null
  imageUrl: string | null
  audioUrl: string | null
  lyrics: string | null
  lyricsLrc: string | null
}

export function mesclar(
  minhas: TrackDoCliente[],
  rede: CatalogItem[] | null,
  meuApelido: string | null,
): Unificada[] {
  const doCliente: Unificada[] = minhas
    .filter((t) => t.audioUrl)
    .map((t) => ({
      id: t.id, title: t.title, occasion: t.occasion, musicalStyle: t.musicalStyle,
      imageUrl: t.imageUrl, audioUrl: t.audioUrl as string, lyrics: t.lyrics,
      lyricsLrc: t.lyricsLrc, apelido: meuApelido, minha: true, publico: !!t.publico,
      favorited: false,
    }))

  // Música sua publicada na Rede está nas duas listas — aparecer duas vezes
  // pareceria bug. Vale a versão "minha".
  const ids = new Set(doCliente.map((l) => l.id))
  const daRede: Unificada[] = (rede ?? [])
    .filter((i) => !ids.has(i.orderId))
    .map((i) => ({
      id: i.orderId, title: i.title, occasion: i.occasion, musicalStyle: i.musicalStyle,
      imageUrl: i.imageUrl, audioUrl: i.audioUrl, lyrics: i.lyrics ?? null,
      lyricsLrc: i.lyricsLrc ?? null, apelido: i.authorApelido, minha: false, publico: true,
      favorited: i.favorited,
    }))

  // As do cliente primeiro: quem procura algo que tem em casa espera achar o
  // seu antes do de estranho.
  return [...doCliente, ...daRede]
}

// Filtro aplicado às músicas DO CLIENTE (as da Rede já vêm filtradas do
// servidor). Elas são poucas e estão todas carregadas, então filtrar na tela
// aqui não custa nada.
export function casaFiltroCliente(ocasiao: string, estilo: string | null, filtro: Filtro): boolean {
  if (!filtro) return true
  if (filtro.tipo === "ocasiao") return ocasiao === filtro.valor
  // Pelo nome unificado, igual ao servidor: a música do cliente gravada com o
  // emoji antigo ("🪗 Forró") tem que entrar no mesmo ritmo do mural.
  return ritmosDa(estilo).includes(nomeDoRitmo(filtro.valor))
}
