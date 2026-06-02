"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Question = { id: string; label: string; type: string; required: boolean; sort_order: number }

export default function QuestionActions({
  mode, subcategoryId, question, nextOrder,
}: {
  mode: "create" | "edit"
  subcategoryId: string
  question?: Question
  nextOrder: number
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(question?.label ?? "")
  const [type, setType] = useState(question?.type ?? "text")
  const [required, setRequired] = useState(question?.required ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSave = async () => {
    setError("")
    setSaving(true)
    const res = await fetch(
      mode === "create"
        ? "/api/admin/wizard/perguntas"
        : `/api/admin/wizard/perguntas/${question!.id}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "create"
            ? { subcategory_id: subcategoryId, label, type, required, sort_order: nextOrder }
            : { label, type, required }
        ),
      }
    )
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error); return }
    setOpen(false)
    router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm(`Excluir esta pergunta?`)) return
    await fetch(`/api/admin/wizard/perguntas/${question!.id}`, { method: "DELETE" })
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
          {mode === "create" ? "+ Nova pergunta" : "Editar"}
        </button>
        {mode === "edit" && (
          <button onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300 px-3 py-2 rounded-xl border border-white/5 hover:border-red-500/20 transition-all">✕</button>
        )}
      </div>
    )
  }

  return (
    <div className="w-full mt-4 bg-black/60 border border-white/10 rounded-2xl p-5 space-y-3">
      <h3 className="font-semibold text-sm text-gray-400 uppercase tracking-wider">
        {mode === "create" ? "Nova pergunta" : "Editar pergunta"}
      </h3>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Texto da pergunta</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500">
          <option value="text">Texto curto</option>
          <option value="textarea">Texto longo</option>
          <option value="select">Seleção</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="accent-pink-500" />
        Obrigatória
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
