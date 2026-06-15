"use client"

import { useState } from "react"

const EFFECTS: { value: string; label: string }[] = [
  { value: "slide",     label: "Slide Horizontal" },
  { value: "fade",      label: "Fade" },
  { value: "cards",     label: "Cards 3D" },
  { value: "coverflow", label: "Coverflow" },
]

export default function PhotoEffectSelect({
  orderId,
  current,
}: {
  orderId: string
  current: string | null
}) {
  const [value, setValue]   = useState(current ?? "slide")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function change(next: string) {
    setValue(next)
    setSaving(true)
    setSaved(false)
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_effect: next }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <label className="text-xs text-gray-500">🎞 Efeito das fotos no player:</label>
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        disabled={saving}
        className="text-xs bg-black/60 border border-white/15 rounded-lg px-2 py-1.5 text-gray-200 focus:border-pink-500/60 outline-none disabled:opacity-50"
      >
        {EFFECTS.map((e) => (
          <option key={e.value} value={e.value}>{e.label}</option>
        ))}
      </select>
      {saving && <span className="text-xs text-gray-500">salvando…</span>}
      {saved && <span className="text-xs text-green-400">✓ salvo</span>}
    </div>
  )
}
