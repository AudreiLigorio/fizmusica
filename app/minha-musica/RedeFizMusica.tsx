"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePlayer } from "./PlayerContext"
import PlaylistDetailModal from "./PlaylistDetailModal"
import AddToPlaylistModal from "./AddToPlaylistModal"
import CreatePlaylistModal from "./CreatePlaylistModal"

type CatalogItem = {
  orderId: string
  slug: string
  title: string
  occasion: string
  musicalStyle: string | null
  imageUrl: string
  audioUrl: string
  lyrics: string | null
  lyricsLrc: string | null
  favorited: boolean
}

// Rede Fiz Música: músicas de outros clientes que autorizaram divulgação.
// Nunca mostra o nome do homenageado (dado de terceiro sem consentimento
// próprio) nem fotos do cliente — só título real da música + ocasião +
// capa gerada pelo Suno, tudo vindo direto do banco (nada fixo).
// Só um filtro ativo por vez (ocasião OU estilo, nunca os dois juntos —
// combinar os dois deixou a interação confusa no rascunho).
type Filtro = { tipo: "ocasiao" | "estilo"; valor: string } | null
type Playlist = { id: string; nome: string; track_order_ids: string[] }

// Pill de filtro — extraída pra não repetir o gradiente/sombra do estado
// ativo duas vezes (ocasião e estilo usam a mesma peça visual).
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-[1.04] active:scale-95 ${
        active ? "border-transparent text-white shadow-[0_4px_16px_-2px_rgba(217,70,239,0.55)]" : "border-white/10 bg-white/[0.04] text-white/55 hover:text-white/85 hover:border-white/20"
      }`}
      style={active ? { background: "linear-gradient(135deg, #f0196b, #d946ef)" } : undefined}
    >
      {children}
    </button>
  )
}

export default function RedeFizMusica({ onPlaylistsChanged }: { onPlaylistsChanged?: () => void }) {
  const [items, setItems] = useState<CatalogItem[] | null>(null)
  const [filtro, setFiltro] = useState<Filtro>(null)
  const { track: nowPlaying, playing, playTrack } = usePlayer()

  // Playlist é a mesma tabela/API de "Minhas Músicas" (guarda ids de pedido,
  // não importa se o pedido é seu ou de outra pessoa), só que com fetch
  // próprio: os dois cartões vivem em componentes separados na tela, não
  // vale a pena compartilhar estado por isso.
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null)
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null)
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null)
  // Criação de playlist: orderId fica pendente enquanto o modal de nome está
  // aberto — undefined quando a playlist nasce vazia.
  const [creatingPlaylistOpen, setCreatingPlaylistOpen] = useState(false)
  const [pendingOrderId, setPendingOrderId] = useState<string | undefined>(undefined)

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" }
  }

  async function carregar() {
    const headers = await authHeaders()
    const res = await fetch("/api/catalog", { headers })
    const d = await res.json().catch(() => ({}))
    setItems(d.items ?? [])
  }

  async function carregarPlaylists() {
    const headers = await authHeaders()
    const res = await fetch("/api/playlists", { headers })
    const d = await res.json().catch(() => ({}))
    setPlaylists(d.playlists ?? [])
  }

  useEffect(() => { carregar(); carregarPlaylists() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function abrirAdicionar(orderId: string) {
    // Recarrega antes de decidir — este cartão só busca playlists no mount,
    // então uma playlist criada em "Minhas Músicas" (estado separado) não
    // apareceria aqui sem isso.
    const headers = await authHeaders()
    const res = await fetch("/api/playlists", { headers })
    const d = await res.json().catch(() => ({}))
    const lista: Playlist[] = d.playlists ?? []
    setPlaylists(lista)
    // Só uma playlist existente? Adiciona direto, sem perguntar qual —
    // o popup de escolher só faz sentido quando há de fato uma escolha.
    if (lista.length === 1) {
      adicionarNaPlaylist(lista[0].id, orderId)
    } else {
      setAddingTrackId(orderId)
    }
  }

  function abrirCriarPlaylist(orderId?: string) {
    setPendingOrderId(orderId)
    setCreatingPlaylistOpen(true)
  }

  async function confirmarCriarPlaylist(nome: string) {
    setCreatingPlaylistOpen(false)
    const headers = await authHeaders()
    const res = await fetch("/api/playlists", { method: "POST", headers, body: JSON.stringify({ nome, orderId: pendingOrderId }) })
    const d = await res.json().catch(() => ({}))
    await carregarPlaylists()
    onPlaylistsChanged?.()
    // Leva o cliente direto pra playlist recém-criada — sem isso, o card
    // novo entra no fim de uma lista que rola horizontal e passa despercebido.
    if (d.playlist?.id) setOpenPlaylistId(d.playlist.id)
  }

  async function adicionarNaPlaylist(playlistId: string, orderId: string) {
    const headers = await authHeaders()
    await fetch(`/api/playlists/${playlistId}`, { method: "PATCH", headers, body: JSON.stringify({ addOrderId: orderId }) })
    await carregarPlaylists()
    onPlaylistsChanged?.()
    setOpenPlaylistId(playlistId)
  }

  async function favoritar(orderId: string) {
    // Otimista: alterna na hora e já reordena (favoritado sobe pro topo).
    setItems((prev) => {
      if (!prev) return prev
      const next = prev.map((it) => (it.orderId === orderId ? { ...it, favorited: !it.favorited } : it))
      return [...next].sort((a, b) => Number(b.favorited) - Number(a.favorited))
    })
    const headers = await authHeaders()
    await fetch("/api/catalog/favorite", { method: "POST", headers, body: JSON.stringify({ orderId }) }).catch(() => {})
  }

  if (!items || items.length === 0) return null

  // Agrupado por ocasião — o cliente navega por tema em vez de rolar tudo junto.
  const porOcasiao = new Map<string, CatalogItem[]>()
  for (const it of items) {
    const lista = porOcasiao.get(it.occasion) ?? []
    lista.push(it)
    porOcasiao.set(it.occasion, lista)
  }
  const ocasioes = [...porOcasiao.entries()].sort((a, b) => b[1].length - a[1].length)

  // Um pedido pode ter mais de um estilo marcado ("🎸 Rock, 🎵 Forró") — nesse
  // caso ele entra em cada grupo separadamente.
  const porEstilo = new Map<string, CatalogItem[]>()
  for (const it of items) {
    for (const estilo of (it.musicalStyle ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      const lista = porEstilo.get(estilo) ?? []
      lista.push(it)
      porEstilo.set(estilo, lista)
    }
  }
  const estilos = [...porEstilo.entries()].sort((a, b) => b[1].length - a[1].length)

  const favoritados = items.filter((it) => it.favorited)

  const visiveis = !filtro
    ? items
    : filtro.tipo === "ocasiao"
      ? porOcasiao.get(filtro.valor) ?? []
      : porEstilo.get(filtro.valor) ?? []

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">🎧 Ouvir na Rede Fiz Música</h3>
      <p className="text-xs text-white/50 mb-3">Músicas de outros clientes que decidiram publicar.</p>

      {favoritados.length > 0 && (
        <div className="mb-4 pb-4 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-wide font-bold text-white/30 mb-1.5">❤️ Favoritas — toque no + para adicionar a uma playlist</p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {favoritados.map((it) => {
              const isPlaying = nowPlaying?.id === it.orderId && playing
              return (
                <div key={it.orderId} className="shrink-0 w-28 group">
                  <div
                    className="relative w-28 h-28 rounded-xl overflow-hidden border border-white/10 bg-cover bg-center"
                    style={{ backgroundImage: `url(${it.imageUrl})` }}
                  >
                    <button
                      type="button"
                      onClick={() => playTrack({ id: it.orderId, title: it.title, occasion: it.occasion, audioUrl: it.audioUrl, imageUrl: it.imageUrl, lyrics: it.lyrics, lyricsLrc: it.lyricsLrc })}
                      className="absolute inset-0 flex items-center justify-center text-2xl"
                    >
                      {isPlaying && <div className="absolute inset-0 bg-black/35 rounded-xl flex items-center justify-center text-xl">❚❚</div>}
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirAdicionar(it.orderId)}
                      aria-label="Adicionar à playlist"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-xs font-bold hover:scale-110 transition-transform"
                    >
                      +
                    </button>
                  </div>
                  <p className={`text-xs font-medium mt-1.5 truncate transition-colors ${isPlaying ? "text-fuchsia-300" : "group-hover:text-fuchsia-300"}`}>{it.title}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-[10px] uppercase tracking-wide font-bold text-white/30 mb-1.5">Por ocasião</p>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
        <Pill active={filtro === null} onClick={() => setFiltro(null)}>Todas · {items.length}</Pill>
        {ocasioes.map(([ocasiao, lista]) => (
          <Pill key={ocasiao} active={filtro?.tipo === "ocasiao" && filtro.valor === ocasiao} onClick={() => setFiltro({ tipo: "ocasiao", valor: ocasiao })}>
            {ocasiao} · {lista.length}
          </Pill>
        ))}
      </div>

      {estilos.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wide font-bold text-white/30 mb-1.5">Por estilo</p>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-1 -mx-1 px-1">
            {estilos.map(([estilo, lista]) => (
              <Pill key={estilo} active={filtro?.tipo === "estilo" && filtro.valor === estilo} onClick={() => setFiltro({ tipo: "estilo", valor: estilo })}>
                {estilo} · {lista.length}
              </Pill>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {visiveis.map((it) => {
          const isPlaying = nowPlaying?.id === it.orderId && playing
          return (
            <div key={it.orderId} className="shrink-0 w-32">
              <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-white/10">
                <button
                  type="button"
                  onClick={() => playTrack({ id: it.orderId, title: it.title, occasion: it.occasion, audioUrl: it.audioUrl, imageUrl: it.imageUrl, lyrics: it.lyrics, lyricsLrc: it.lyricsLrc })}
                  className="block w-full h-full"
                >
                  <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${it.imageUrl})` }} />
                  {isPlaying && <div className="absolute inset-0 bg-black/35 flex items-center justify-center text-2xl">❚❚</div>}
                </button>
                <button
                  onClick={() => favoritar(it.orderId)}
                  aria-label={it.favorited ? "Remover dos favoritos" : "Favoritar"}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-sm transition-transform hover:scale-110"
                >
                  {it.favorited ? "❤️" : "🤍"}
                </button>
                <button
                  type="button"
                  onClick={() => abrirAdicionar(it.orderId)}
                  aria-label="Adicionar à playlist"
                  className="absolute top-1.5 right-9 w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-sm font-bold transition-transform hover:scale-110"
                >
                  +
                </button>
              </div>
              <p className={`text-xs font-medium mt-1.5 truncate ${isPlaying ? "text-fuchsia-300" : ""}`}>{it.title}</p>
              <p className="text-[11px] text-white/40 truncate">{it.occasion}</p>
            </div>
          )
        })}
      </div>

      <PlaylistDetailModal playlistId={openPlaylistId} onClose={() => setOpenPlaylistId(null)} onChanged={() => { carregarPlaylists(); onPlaylistsChanged?.() }} />
      <AddToPlaylistModal
        open={!!addingTrackId}
        playlists={playlists}
        onClose={() => setAddingTrackId(null)}
        onAdd={(playlistId) => { if (addingTrackId) adicionarNaPlaylist(playlistId, addingTrackId) }}
        onCreateNew={() => abrirCriarPlaylist(addingTrackId ?? undefined)}
      />
      <CreatePlaylistModal
        open={creatingPlaylistOpen}
        onClose={() => setCreatingPlaylistOpen(false)}
        onCreate={confirmarCriarPlaylist}
      />
    </div>
  )
}
