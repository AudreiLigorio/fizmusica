"use client"

import { useState } from "react"
import { createPortal } from "react-dom"

const MAX_NOME = 30

export default function CreatePlaylistModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (nome: string) => void
}) {
  const [nome, setNome] = useState("")

  if (!open) return null

  function fechar() {
    setNome("")
    onClose()
  }

  function confirmar() {
    const limpo = nome.trim()
    if (!limpo) return
    onCreate(limpo)
    setNome("")
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 text-white" onClick={fechar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#15111f] p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm">Nova playlist</p>
          <button onClick={fechar} className="text-white/40 hover:text-white text-lg leading-none" aria-label="Fechar">✕</button>
        </div>

        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value.slice(0, MAX_NOME))}
          onKeyDown={(e) => { if (e.key === "Enter") confirmar() }}
          maxLength={MAX_NOME}
          placeholder="Ex: Favoritas da Vó"
          className="w-full bg-black/20 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-500/40 mb-1.5"
        />
        <p className="text-[11px] text-white/30 text-right mb-3">{nome.length}/{MAX_NOME}</p>

        <button
          onClick={confirmar}
          disabled={!nome.trim()}
          className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
        >
          Criar playlist
        </button>
      </div>
    </div>,
    document.body
  )
}
