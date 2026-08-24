"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePlayer } from "./PlayerContext"
import PlaylistDetailModal from "./PlaylistDetailModal"
import AddToPlaylistModal from "./AddToPlaylistModal"
import CreatePlaylistModal from "./CreatePlaylistModal"

export type LibraryTrack = {
  id: string
  title: string
  occasion: string
  slug: string
  imageUrl: string | null
  audioUrl: string | null
  lyrics: string | null
  lyricsLrc: string | null
}
type Playlist = { id: string; nome: string; track_order_ids: string[] }

// Sem foto de capa própria pra cada música (o design não pediu upload de capa
// custom) — gradiente estável por id, pra cada card ter uma cara diferente
// sem depender de imagem.
const GRADIENTS = [
  "linear-gradient(150deg,#3a1440,#7a1f5c)",
  "linear-gradient(150deg,#1c2f52,#3d1f66)",
  "linear-gradient(150deg,#4a1330,#a3226b)",
  "linear-gradient(150deg,#122b3a,#2c6b6f)",
  "linear-gradient(150deg,#3a2312,#8a4a1f)",
  "linear-gradient(150deg,#241541,#5c1f8a)",
]
function gradientFor(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}

// "Minhas músicas" não guarda nada de novo — é derivado dos pedidos entregues
// (prop `tracks`, montada em page.tsx a partir dos mesmos `orders` que a
// lista de pedidos já usa). Só a playlist (agrupamento) tem tabela própria.
export default function MinhasMusicas({ tracks }: { tracks: LibraryTrack[] }) {
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overZone, setOverZone] = useState<string | null>(null)
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null)
  // Toque no "+" — o caminho que funciona em qualquer aparelho (arrastar é
  // só desktop; drag nativo HTML5 não existe em navegador mobile).
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null)
  // Criação de playlist: orderId fica pendente enquanto o modal de nome está
  // aberto — undefined quando a playlist nasce vazia (raia "Minha Playlist").
  const [creatingPlaylistOpen, setCreatingPlaylistOpen] = useState(false)
  const [pendingOrderId, setPendingOrderId] = useState<string | undefined>(undefined)
  const { track: nowPlaying, playing, playTrack } = usePlayer()

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" }
  }

  async function carregar() {
    const headers = await authHeaders()
    const res = await fetch("/api/playlists", { headers })
    const d = await res.json().catch(() => ({}))
    setPlaylists(d.playlists ?? [])
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function abrirCriarPlaylist(orderId?: string) {
    setPendingOrderId(orderId)
    setCreatingPlaylistOpen(true)
  }

  async function confirmarCriarPlaylist(nome: string) {
    setCreatingPlaylistOpen(false)
    const headers = await authHeaders()
    const res = await fetch("/api/playlists", { method: "POST", headers, body: JSON.stringify({ nome, orderId: pendingOrderId }) })
    const d = await res.json().catch(() => ({}))
    await carregar()
    // Leva o cliente direto pra playlist recém-criada — sem isso, o card
    // novo entra no fim de uma lista que rola horizontal e passa despercebido.
    if (d.playlist?.id) setOpenPlaylistId(d.playlist.id)
  }

  async function adicionar(playlistId: string, orderId: string) {
    const headers = await authHeaders()
    await fetch(`/api/playlists/${playlistId}`, { method: "PATCH", headers, body: JSON.stringify({ addOrderId: orderId }) })
    await carregar()
    setOpenPlaylistId(playlistId)
  }

  if (tracks.length === 0) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">🗂️ Minhas Músicas</h3>
      <p className="text-xs text-white/50 mb-3">Toque no + de uma música para adicionar a uma playlist.</p>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 mb-4">
        {tracks.map((t) => {
          const isPlaying = nowPlaying?.id === t.id && playing
          return (
            <div key={t.id} className="shrink-0 w-28 group">
              <div
                className="relative w-28 h-28 rounded-xl border border-white/10 cursor-grab active:cursor-grabbing bg-cover bg-center"
                style={{
                  background: t.imageUrl ? `url(${t.imageUrl}) center/cover` : gradientFor(t.id),
                  opacity: dragId === t.id ? 0.4 : 1,
                }}
                draggable
                onDragStart={() => setDragId(t.id)}
                onDragEnd={() => setDragId(null)}
              >
                <button
                  type="button"
                  disabled={!t.audioUrl}
                  onClick={() => t.audioUrl && playTrack({ id: t.id, title: t.title, occasion: t.occasion, audioUrl: t.audioUrl, imageUrl: t.imageUrl, lyrics: t.lyrics, lyricsLrc: t.lyricsLrc })}
                  className="absolute inset-0 flex items-center justify-center text-2xl disabled:cursor-default"
                >
                  {!t.imageUrl && "▶"}
                  {isPlaying && <div className="absolute inset-0 bg-black/35 rounded-xl flex items-center justify-center text-xl">❚❚</div>}
                </button>
                <button
                  type="button"
                  onClick={() => setAddingTrackId(t.id)}
                  aria-label="Adicionar à playlist"
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-xs font-bold hover:scale-110 transition-transform"
                >
                  +
                </button>
              </div>
              <p className={`text-xs font-medium mt-1.5 truncate transition-colors ${isPlaying ? "text-fuchsia-300" : "group-hover:text-fuchsia-300"}`}>{t.title}</p>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] uppercase tracking-wide font-bold text-white/30 mb-1.5">Minha Playlist</p>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {playlists?.map((pl) => (
          <button
            key={pl.id}
            type="button"
            onClick={() => setOpenPlaylistId(pl.id)}
            onDragOver={(e) => { e.preventDefault(); setOverZone(pl.id) }}
            onDragLeave={() => setOverZone(null)}
            onDrop={(e) => { e.preventDefault(); setOverZone(null); if (dragId) adicionar(pl.id, dragId) }}
            className={`shrink-0 w-32 text-left rounded-xl border p-3 transition-colors ${overZone === pl.id ? "border-fuchsia-500/60 bg-fuchsia-500/10" : "border-white/10 bg-black/20"}`}
          >
            <div className="grid grid-cols-2 gap-0.5 w-12 h-12 rounded-lg overflow-hidden mb-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white/10"
                  style={pl.track_order_ids[i] ? { background: gradientFor(pl.track_order_ids[i]) } : undefined}
                />
              ))}
            </div>
            <p className="text-xs font-medium truncate">{pl.nome}</p>
            <p className="text-[11px] text-white/40">{pl.track_order_ids.length} música{pl.track_order_ids.length === 1 ? "" : "s"}</p>
          </button>
        ))}

        <div
          role="button"
          tabIndex={0}
          onClick={() => abrirCriarPlaylist()}
          onKeyDown={(e) => { if (e.key === "Enter") abrirCriarPlaylist() }}
          onDragOver={(e) => { e.preventDefault(); setOverZone("new") }}
          onDragLeave={() => setOverZone(null)}
          onDrop={(e) => { e.preventDefault(); setOverZone(null); if (dragId) abrirCriarPlaylist(dragId) }}
          className={`shrink-0 w-32 h-[104px] rounded-xl border border-dashed flex flex-col items-center justify-center gap-1 text-center px-2 cursor-pointer transition-colors ${overZone === "new" ? "border-fuchsia-500/60 bg-fuchsia-500/10 text-white" : "border-white/15 text-white/40 hover:text-white/70 hover:border-white/25"}`}
        >
          <span className="text-lg">➕</span>
          <span className="text-[10px] leading-tight">Nova playlist</span>
        </div>
      </div>

      <PlaylistDetailModal playlistId={openPlaylistId} onClose={() => setOpenPlaylistId(null)} onChanged={carregar} />
      <AddToPlaylistModal
        open={!!addingTrackId}
        playlists={playlists}
        onClose={() => setAddingTrackId(null)}
        onAdd={(playlistId) => { if (addingTrackId) adicionar(playlistId, addingTrackId) }}
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
