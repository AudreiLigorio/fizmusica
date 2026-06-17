"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function EditEmail({ orderId, current }: { orderId: string; current: string }) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [email, setEmail]   = useState(current)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState<string | null>(null)

  async function save() {
    setSaving(true); setMsg(null)
    const res = await fetch(`/api/admin/pedidos/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    setSaving(false)
    if (res.ok) { setMsg("✅ E-mail atualizado"); setOpen(false); router.refresh() }
    else { const d = await res.json(); setMsg(`❌ ${d.error ?? "Erro"}`) }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-gray-500 hover:text-pink-400 transition-colors mt-1">
        ✏️ Corrigir e-mail
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      <input
        type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500"
      />
      <div className="flex gap-2 items-center">
        <button onClick={save} disabled={saving} className="text-xs bg-pink-500 hover:bg-pink-600 disabled:opacity-50 px-3 py-1.5 rounded-lg font-medium">
          {saving ? "Salvando…" : "Salvar"}
        </button>
        <button onClick={() => { setOpen(false); setEmail(current); setMsg(null) }} className="text-xs text-gray-500 hover:text-white">Cancelar</button>
        {msg && <span className="text-xs text-gray-400">{msg}</span>}
      </div>
      <p className="text-[11px] text-gray-600">Ao corrigir, o pedido passa a aparecer na conta do cliente com o e-mail certo.</p>
    </div>
  )
}
