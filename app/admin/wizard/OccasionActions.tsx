"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Occasion = { id: string; label: string; emoji?: string; slug: string; active: boolean; sort_order: number }

export default function OccasionActions({
  mode,
  occasion,
}: {
  mode: "create" | "edit"
  occasion?: Occasion
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(occasion?.label ?? "")
  const [emoji, setEmoji] = useState(occasion?.emoji ?? "")
  const [slug, setSlug] = useState(occasion?.slug ?? "")
  const [active, setActive] = useState(occasion?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSave = async () => {
    setError("")
    setSaving(true)
    const res = await fetch(
      mode === "create"
        ? "/api/admin/wizard/ocasioes"
        : `/api/admin/wizard/ocasioes/${occasion!.id}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, emoji, slug, active }),
      }
    )
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error); return }
    setOpen(false)
    router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm(`Excluir "${occasion?.label}"? Isso remove todas as subcategorias e perguntas.`)) return
    await fetch(`/api/admin/wizard/ocasioes/${occasion!.id}`, { method: "DELETE" })
    router.refresh()
  }

  if (!open) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(true)}
          className={`text-sm px-4 py-2 rounded-xl border transition-all ${
            mode === "create"
              ? "bg-pink-500 hover:bg-pink-600 border-transparent text-white font-semibold"
              : "border-white/10 hover:border-white/30 text-gray-400 hover:text-white"
          }`}
        >
          {mode === "create" ? "+ Nova ocasião" : "Editar"}
        </button>
        {mode === "edit" && (
          <button onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300 px-3 py-2 rounded-xl border border-white/5 hover:border-red-500/20 transition-all">
            ✕
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="w-full mt-4 bg-black/60 border border-white/10 rounded-2xl p-5 space-y-3">
      <h3 className="font-semibold text-sm text-gray-400 uppercase tracking-wider">
        {mode === "create" ? "Nova ocasião" : "Editar ocasião"}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Emoji</label>
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 mb-1 block">Slug (ex: amor-relacionamentos)</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500 font-mono" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-pink-500" />
        Ativo
      </label>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-white px-4 py-2 rounded-xl border border-white/10 transition-all">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="text-sm bg-pink-500 hover:bg-pink-600 disabled:opacity-40 px-5 py-2 rounded-xl font-semibold transition-all">
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  )
}
