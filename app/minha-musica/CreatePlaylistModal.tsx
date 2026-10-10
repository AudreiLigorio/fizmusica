"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "@/lib/supabase"
import { mesmoNomePlaylist } from "@/lib/playlist"

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
  // Nomes que a pessoa já usa — pra avisar ANTES de criar uma segunda
  // playlist com o mesmo nome (pedido do Audrei, 2026-10-10). O servidor
  // recusa também (app/api/playlists), isto aqui é pra ela saber na hora.
  const [existentes, setExistentes] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    let vivo = true
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const r = await fetch("/api/playlists", { headers: { Authorization: `Bearer ${session.access_token}` } }).then((x) => x.json())
        if (vivo) setExistentes(((r.playlists ?? []) as { nome: string }[]).map((p) => p.nome))
      } catch { /* sem a lista, o servidor ainda barra */ }
    })()
    return () => { vivo = false }
  }, [open])

  if (!open) return null

  const repetido = nome.trim() ? existentes.find((e) => mesmoNomePlaylist(e, nome)) : undefined

  function fechar() {
    setNome("")
    onClose()
  }

  function confirmar() {
    const limpo = nome.trim()
    if (!limpo || repetido) return
    onCreate(limpo)
    setNome("")
  }

  return createPortal(
    <div className="fm-popup-fundo fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 text-white" onClick={fechar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fm-popup w-full max-w-sm rounded-2xl border border-white/10 bg-[#15111f] p-5"
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
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-[13px] text-red-500 leading-snug" role="alert">
            {repetido ? <>Você já tem uma playlist chamada “{repetido}”. Escolha outro nome.</> : null}
          </p>
          <p className="text-[13px] text-white/30 shrink-0">{nome.length}/{MAX_NOME}</p>
        </div>

        <button
          onClick={confirmar}
          disabled={!nome.trim() || !!repetido}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
        >
          Criar playlist
        </button>
      </div>
    </div>,
    document.body
  )
}
