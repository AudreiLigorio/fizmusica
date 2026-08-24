"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePlayer } from "./PlayerContext"

type Track = { orderId: string; title: string; occasion: string; imageUrl: string | null; audioUrl: string }
type PlaylistFull = { id: string; nome: string; tracks: Track[] }

// Uma raia por playlist, sempre visível na tela (em vez de só um card que
// abre modal) — pra criar músicas seja tão simples quanto tocar no + de
// qualquer faixa (Minhas Músicas ou Rede Fiz Música) e ver o resultado
// direto aqui embaixo. `version` sobe toda vez que qualquer um dos dois
// cartões cria/altera uma playlist, disparando o recarregamento.
export default function MinhasPlaylists({ version }: { version: number }) {
  const [playlists, setPlaylists] = useState<PlaylistFull[] | null>(null)
  const { track: nowPlaying, playing, playTrack } = usePlayer()

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ""}` }
  }

  async function carregar() {
    const headers = await authHeaders()
    const listRes = await fetch("/api/playlists", { headers })
    const listData = await listRes.json().catch(() => ({}))
    const lista: { id: string; nome: string }[] = listData.playlists ?? []
    const detalhes = await Promise.all(
      lista.map(async (pl) => {
        const res = await fetch(`/api/playlists/${pl.id}`, { headers })
        const d = await res.json().catch(() => ({}))
        return { id: pl.id, nome: pl.nome, tracks: d.tracks ?? [] } as PlaylistFull
      })
    )
    setPlaylists(detalhes)
  }

  useEffect(() => { carregar() }, [version]) // eslint-disable-line react-hooks/exhaustive-deps

  async function remover(playlistId: string, orderId: string) {
    // Otimista: some da raia na hora, sem esperar o servidor.
    setPlaylists((prev) => prev?.map((pl) => (pl.id === playlistId ? { ...pl, tracks: pl.tracks.filter((t) => t.orderId !== orderId) } : pl)) ?? null)
    const headers = await authHeaders()
    await fetch(`/api/playlists/${playlistId}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ removeOrderId: orderId }) })
  }

  if (!playlists || playlists.length === 0) return null

  return (
    <>
      {playlists.map((pl) => (
        <div key={pl.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">🎶 {pl.nome}</h3>

          {pl.tracks.length === 0 ? (
            <p className="text-xs text-white/40 leading-relaxed">
              Clique no + de uma música na Rede Fiz Música e adicione músicas aqui.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {pl.tracks.map((t) => {
                const isPlaying = nowPlaying?.id === t.orderId && playing
                return (
                  <div key={t.orderId} className="shrink-0 w-28 group">
                    <div
                      className="relative w-28 h-28 rounded-xl overflow-hidden border border-white/10 bg-cover bg-center"
                      style={{
                        backgroundImage: t.imageUrl ? `url(${t.imageUrl})` : undefined,
                        background: t.imageUrl ? undefined : "linear-gradient(150deg,#3a1440,#7a1f5c)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => playTrack({ id: t.orderId, title: t.title, occasion: t.occasion, audioUrl: t.audioUrl, imageUrl: t.imageUrl, lyrics: null, lyricsLrc: null })}
                        className="absolute inset-0"
                        aria-label={isPlaying ? "Pausar" : "Tocar"}
                      >
                        {isPlaying && <div className="absolute inset-0 bg-black/35 flex items-center justify-center text-xl">❚❚</div>}
                      </button>
                      <button
                        type="button"
                        onClick={() => remover(pl.id, t.orderId)}
                        aria-label="Remover da playlist"
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-xs font-bold hover:scale-110 hover:bg-red-500/70 transition-all"
                      >
                        −
                      </button>
                    </div>
                    <p className={`text-xs font-medium mt-1.5 truncate transition-colors ${isPlaying ? "text-fuchsia-300" : "group-hover:text-fuchsia-300"}`}>{t.title}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </>
  )
}
