"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "@/lib/supabase"
import { usePlayer } from "./PlayerContext"

type Track = { orderId: string; title: string; occasion: string; imageUrl: string | null; audioUrl: string }
type Playlist = { id: string; nome: string; track_order_ids: string[] }

// Tela de detalhe de uma playlist — abre a partir de qualquer prateleira
// (Minhas músicas ou Rede Fiz Música, ambas usam a mesma API de playlist).
// Título de cada faixa é sempre o derivado da ocasião: a playlist pode
// misturar música própria com favoritada de outra conta.
export default function PlaylistDetailModal({
  playlistId,
  onClose,
  onChanged,
}: {
  playlistId: string | null
  onClose: () => void
  onChanged?: () => void
}) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [tracks, setTracks] = useState<Track[] | null>(null)
  const { track: nowPlaying, playing, playTrack } = usePlayer()

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" }
  }

  async function carregar() {
    if (!playlistId) return
    const headers = await authHeaders()
    const res = await fetch(`/api/playlists/${playlistId}`, { headers })
    const d = await res.json().catch(() => ({}))
    setPlaylist(d.playlist ?? null)
    setTracks(d.tracks ?? [])
  }

  useEffect(() => {
    setTracks(null)
    if (playlistId) carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId])

  async function remover(orderId: string) {
    if (!playlistId) return
    setTracks((prev) => prev?.filter((t) => t.orderId !== orderId) ?? null) // otimista
    const headers = await authHeaders()
    await fetch(`/api/playlists/${playlistId}`, { method: "PATCH", headers, body: JSON.stringify({ removeOrderId: orderId }) })
    onChanged?.()
  }

  async function excluirPlaylist() {
    if (!playlistId) return
    if (!window.confirm(`Excluir a playlist "${playlist?.nome}"? Isso não apaga as músicas, só a coleção.`)) return
    const headers = await authHeaders()
    await fetch(`/api/playlists/${playlistId}`, { method: "DELETE", headers })
    onChanged?.()
    onClose()
  }

  if (!playlistId) return null

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 text-white" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#15111f] p-6"
      >
        <div className="mb-4">
          <p className="font-bold text-lg truncate">{playlist?.nome ?? "Playlist"}</p>
          <p className="text-xs text-white/40">{tracks?.length ?? 0} música{tracks?.length === 1 ? "" : "s"}</p>
        </div>

        {tracks === null ? (
          <p className="text-xs text-white/40 text-center py-6">Carregando…</p>
        ) : tracks.length === 0 ? (
          <p className="text-xs text-white/40 text-center py-6">Nenhuma música aqui ainda.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {tracks.map((t) => {
              const isPlaying = nowPlaying?.id === t.orderId && playing
              return (
                <div key={t.orderId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <button
                    onClick={() => { playTrack({ id: t.orderId, title: t.title, occasion: t.occasion, audioUrl: t.audioUrl, imageUrl: t.imageUrl, lyrics: null, lyricsLrc: null }); onClose() }}
                    className="relative w-11 h-11 rounded-lg overflow-hidden bg-cover bg-center shrink-0"
                    style={{ backgroundImage: t.imageUrl ? `url(${t.imageUrl})` : undefined, background: t.imageUrl ? undefined : "linear-gradient(135deg,#3a1440,#7a1f5c)" }}
                    aria-label={isPlaying ? "Pausar" : "Tocar"}
                  >
                    {isPlaying && <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-sm">❚❚</div>}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium truncate ${isPlaying ? "text-fuchsia-300" : ""}`}>{t.title}</p>
                    <p className="text-[11px] text-white/40 truncate">{t.occasion}</p>
                  </div>
                  <button
                    onClick={() => remover(t.orderId)}
                    aria-label="Remover da playlist"
                    className="text-white/30 hover:text-red-400 text-sm shrink-0 px-1.5"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <button onClick={excluirPlaylist} className="w-full text-center text-xs text-white/30 hover:text-red-400 py-1.5 transition-colors">
          Excluir playlist
        </button>
      </div>
    </div>,
    document.body
  )
}
