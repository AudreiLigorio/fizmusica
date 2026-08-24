"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePlayer } from "./PlayerContext"
import PlaylistDetailModal from "./PlaylistDetailModal"

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

  async function criarPlaylist(orderId: string) {
    const nome = window.prompt("Nome da playlist:")
    if (!nome?.trim()) return
    const headers = await authHeaders()
    await fetch("/api/playlists", { method: "POST", headers, body: JSON.stringify({ nome: nome.trim(), orderId }) })
    await carregar()
  }

  async function adicionar(playlistId: string, orderId: string) {
    const headers = await authHeaders()
    await fetch(`/api/playlists/${playlistId}`, { method: "PATCH", headers, body: JSON.stringify({ addOrderId: orderId }) })
    await carregar()
  }

  if (tracks.length === 0) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">🗂️ Minhas músicas &amp; playlists</h3>
      <p className="text-xs text-white/50 mb-3">Arraste uma música para começar uma coleção.</p>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {tracks.map((t) => {
          const isPlaying = nowPlaying?.id === t.id && playing
          return (
            <button
              key={t.id}
              type="button"
              disabled={!t.audioUrl}
              onClick={() => t.audioUrl && playTrack({ id: t.id, title: t.title, occasion: t.occasion, audioUrl: t.audioUrl, imageUrl: t.imageUrl, lyrics: t.lyrics, lyricsLrc: t.lyricsLrc })}
              draggable
              onDragStart={() => setDragId(t.id)}
              onDragEnd={() => setDragId(null)}
              className="shrink-0 w-28 group text-left disabled:cursor-default"
            >
              <div
                className="relative w-28 h-28 rounded-xl flex items-center justify-center text-2xl border border-white/10 cursor-grab active:cursor-grabbing bg-cover bg-center"
                style={{
                  background: t.imageUrl ? `url(${t.imageUrl}) center/cover` : gradientFor(t.id),
                  opacity: dragId === t.id ? 0.4 : 1,
                }}
              >
                {!t.imageUrl && "▶"}
                {isPlaying && <div className="absolute inset-0 bg-black/35 rounded-xl flex items-center justify-center text-xl">❚❚</div>}
              </div>
              <p className={`text-xs font-medium mt-1.5 truncate transition-colors ${isPlaying ? "text-fuchsia-300" : "group-hover:text-fuchsia-300"}`}>{t.title}</p>
            </button>
          )
        })}

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
          onDragOver={(e) => { e.preventDefault(); setOverZone("new") }}
          onDragLeave={() => setOverZone(null)}
          onDrop={(e) => { e.preventDefault(); setOverZone(null); if (dragId) criarPlaylist(dragId) }}
          className={`shrink-0 w-32 h-[104px] rounded-xl border border-dashed flex flex-col items-center justify-center gap-1 text-center px-2 transition-colors ${overZone === "new" ? "border-fuchsia-500/60 bg-fuchsia-500/10 text-white" : "border-white/15 text-white/40"}`}
        >
          <span className="text-lg">➕</span>
          <span className="text-[10px] leading-tight">Arraste aqui para criar uma playlist</span>
        </div>
      </div>

      <PlaylistDetailModal playlistId={openPlaylistId} onClose={() => setOpenPlaylistId(null)} onChanged={carregar} />
    </div>
  )
}
