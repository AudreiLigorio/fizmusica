"use client"

import { createPortal } from "react-dom"

type Playlist = { id: string; nome: string; track_order_ids: string[] }

// Arrastar-e-soltar não existe em navegador mobile (drag nativo HTML5 é só
// mouse) — esse modal é o caminho que funciona em qualquer aparelho: toca
// no "+" da música, escolhe a playlist (ou cria uma nova), pronto.
export default function AddToPlaylistModal({
  open,
  playlists,
  onClose,
  onAdd,
  onCreateNew,
}: {
  open: boolean
  playlists: Playlist[] | null
  onClose: () => void
  onAdd: (playlistId: string) => void
  onCreateNew: () => void
}) {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 text-white" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#15111f] p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm">Adicionar à playlist</p>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none" aria-label="Fechar">✕</button>
        </div>

        <div className="space-y-2 mb-3 max-h-[45vh] overflow-y-auto">
          {playlists?.map((pl) => (
            <button
              key={pl.id}
              onClick={() => { onAdd(pl.id); onClose() }}
              className="w-full flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5 transition-colors"
            >
              <span className="text-xs font-medium truncate">{pl.nome}</span>
              <span className="text-[11px] text-white/40 shrink-0">{pl.track_order_ids.length} música{pl.track_order_ids.length === 1 ? "" : "s"}</span>
            </button>
          ))}
          {playlists?.length === 0 && (
            <p className="text-xs text-white/30 text-center py-2">Você ainda não tem nenhuma playlist.</p>
          )}
        </div>

        <button
          onClick={() => { onCreateNew(); onClose() }}
          className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
        >
          ➕ Nova playlist
        </button>
      </div>
    </div>,
    document.body
  )
}
