"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

// O catálogo da Rede virou dado compartilhado da aba Músicas.
//
// Antes cada peça buscava o seu: RedeFizMusica tinha o fetch dentro, e quando
// a lista de resultados entrou (a0c68ae) ela fez outro igual. Agora os filtros
// também precisam da mesma lista (pra montar as pílulas de ocasião e estilo
// com as contagens), e seriam três chamadas iguais na mesma tela.
//
// Uma busca só, dividida por contexto. O favoritar continua otimista — a
// alteração acontece aqui pra que a raia da Rede e a lista de resultados nunca
// discordem sobre o que está favoritado.

export type CatalogItem = {
  orderId: string
  slug?: string
  title: string
  occasion: string
  musicalStyle: string | null
  imageUrl: string | null
  audioUrl: string
  lyrics: string | null
  lyricsLrc: string | null
  authorApelido: string | null
  favorited: boolean
  createdAt: string
}

type Ctx = {
  items: CatalogItem[] | null
  alternarFavorito: (orderId: string) => void
}

const CatalogoCtx = createContext<Ctx>({ items: null, alternarFavorito: () => {} })

export function CatalogoProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CatalogItem[] | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      // Sem sessão o header vai vazio de propósito: /api/catalog responde a
      // anônimo também (Fase 2 da abertura ao visitante), só que cortado.
      const res = await fetch("/api/catalog", {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      })
      const d = await res.json().catch(() => ({}))
      setItems(d.items ?? [])
    })()
  }, [])

  const alternarFavorito = useCallback((orderId: string) => {
    setItems((prev) => {
      if (!prev) return prev
      const next = prev.map((it) => (it.orderId === orderId ? { ...it, favorited: !it.favorited } : it))
      // Favoritado sobe pro topo — pedido antigo do Audrei ("se o cliente
      // favoritar tem que manter como as primeiras").
      return [...next].sort((a, b) => Number(b.favorited) - Number(a.favorited))
    })
  }, [])

  return (
    <CatalogoCtx.Provider value={{ items, alternarFavorito }}>
      {children}
    </CatalogoCtx.Provider>
  )
}

export function useCatalogo() {
  return useContext(CatalogoCtx)
}

// Filtro ativo da aba Músicas. Vive fora dos componentes porque agora é
// compartilhado: as pílulas ficam junto da busca (topo) e o que elas filtram
// está mais abaixo, na raia da Rede ou na lista de resultados.
// Só um filtro por vez (ocasião OU estilo) — combinar os dois deixou a
// interação confusa quando foi testado.
export type Filtro = { tipo: "ocasiao" | "estilo"; valor: string } | null

// Agrupamentos usados pelas pílulas e pela filtragem. Ficam aqui pra a
// contagem mostrada na pílula e o resultado do clique saírem da MESMA conta —
// senão a pílula diz "Rock · 16" e a lista mostra outro número.
export function agruparPorOcasiao(items: CatalogItem[]): Map<string, CatalogItem[]> {
  const m = new Map<string, CatalogItem[]>()
  for (const it of items) {
    const lista = m.get(it.occasion) ?? []
    lista.push(it)
    m.set(it.occasion, lista)
  }
  return m
}

// Um pedido pode ter mais de um estilo marcado ("🎸 Rock, 🎵 Forró") — nesse
// caso ele entra em cada grupo separadamente.
export function agruparPorEstilo(items: CatalogItem[]): Map<string, CatalogItem[]> {
  const m = new Map<string, CatalogItem[]>()
  for (const it of items) {
    for (const estilo of (it.musicalStyle ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      const lista = m.get(estilo) ?? []
      lista.push(it)
      m.set(estilo, lista)
    }
  }
  return m
}

export function aplicarFiltro(items: CatalogItem[], filtro: Filtro): CatalogItem[] {
  if (!filtro) return items
  const grupos = filtro.tipo === "ocasiao" ? agruparPorOcasiao(items) : agruparPorEstilo(items)
  return grupos.get(filtro.valor) ?? []
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
  lyrics: string | null
  lyricsLrc: string | null
  apelido: string | null
  minha: boolean
}

type TrackDoCliente = {
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
      lyricsLrc: t.lyricsLrc, apelido: meuApelido, minha: true,
    }))

  // Música sua publicada na Rede está nas duas listas — aparecer duas vezes
  // pareceria bug. Vale a versão "minha".
  const ids = new Set(doCliente.map((l) => l.id))
  const daRede: Unificada[] = (rede ?? [])
    .filter((i) => !ids.has(i.orderId))
    .map((i) => ({
      id: i.orderId, title: i.title, occasion: i.occasion, musicalStyle: i.musicalStyle,
      imageUrl: i.imageUrl, audioUrl: i.audioUrl, lyrics: i.lyrics,
      lyricsLrc: i.lyricsLrc, apelido: i.authorApelido, minha: false,
    }))

  // As do cliente primeiro: quem procura algo que tem em casa espera achar o
  // seu antes do de estranho.
  return [...doCliente, ...daRede]
}

export function agruparUnificadaPorOcasiao(items: Unificada[]): Map<string, Unificada[]> {
  const m = new Map<string, Unificada[]>()
  for (const it of items) {
    const lista = m.get(it.occasion) ?? []
    lista.push(it)
    m.set(it.occasion, lista)
  }
  return m
}

export function agruparUnificadaPorEstilo(items: Unificada[]): Map<string, Unificada[]> {
  const m = new Map<string, Unificada[]>()
  for (const it of items) {
    for (const estilo of (it.musicalStyle ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      const lista = m.get(estilo) ?? []
      lista.push(it)
      m.set(estilo, lista)
    }
  }
  return m
}

export function aplicarFiltroUnificada(items: Unificada[], filtro: Filtro): Unificada[] {
  if (!filtro) return items
  const grupos = filtro.tipo === "ocasiao" ? agruparUnificadaPorOcasiao(items) : agruparUnificadaPorEstilo(items)
  return grupos.get(filtro.valor) ?? []
}
