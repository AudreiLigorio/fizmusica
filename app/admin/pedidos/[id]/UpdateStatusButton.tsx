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
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const router = useRouter()

  const handleSave = async () => {
    if (status === currentStatus) return
    setSaving(true)
    setFeedback(null)

    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setFeedback({ ok: false, msg: data.error ?? "Erro ao atualizar status." })
      } else {
        setFeedback({ ok: true, msg: "Status atualizado com sucesso!" })
        router.refresh()
      }
    } catch {
      setFeedback({ ok: false, msg: "Falha de conexão. Tente novamente." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <select
        value={status}
        onChange={(e) => { setStatus(e.target.value); setFeedback(null) }}
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

      {feedback && (
        <p className={`text-xs px-1 ${feedback.ok ? "text-green-400" : "text-red-400"}`}>
          {feedback.ok ? "✅ " : "❌ "}{feedback.msg}
        </p>
      )}
    </div>
  )
}
