"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ResolveButton({ id, resolved }: { id: string; resolved: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    await fetch(`/api/admin/payment-alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !resolved }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
        resolved
          ? "border-white/10 text-gray-400 hover:bg-white/5"
          : "border-green-500/30 text-green-400 hover:bg-green-500/10"
      }`}
    >
      {loading ? "…" : resolved ? "Reabrir" : "✓ Marcar resolvido"}
    </button>
  )
}
