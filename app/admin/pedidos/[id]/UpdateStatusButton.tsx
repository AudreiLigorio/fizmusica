"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const STATUS_LABEL: Record<string, string> = {
  PENDING:       "Pendente",
  IN_PRODUCTION: "Em produção",
  DELIVERED:     "Entregue",
  ABANDONED:     "Abandonado",
}

export default function UpdateStatusButton({
  orderId,
  currentStatus,
  options,
}: {
  orderId: string
  currentStatus: string
  options: string[]
}) {
  const [status, setStatus] = useState(currentStatus)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const handleSave = async () => {
    if (status === currentStatus) return
    setSaving(true)
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-500 transition-colors"
      >
        {options.map((s) => (
          <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
        ))}
      </select>
      <button
        onClick={handleSave}
        disabled={saving || status === currentStatus}
        className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all px-4 py-3 rounded-xl text-sm font-semibold"
      >
        {saving ? "Salvando…" : "Atualizar status"}
      </button>
    </div>
  )
}
