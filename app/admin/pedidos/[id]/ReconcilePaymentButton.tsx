"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

// Procura no Mercado Pago por external_reference = orderId e religa o pagamento
// ao pedido. Para o caso "sem pagamento registrado" (o aviso do MP se perdeu).
export default function ReconcilePaymentButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<{ updated?: boolean; message: string } | null>(null)
  const router = useRouter()

  async function handleReconcile() {
    setLoading(true)
    setResult(null)
    const res = await fetch("/api/admin/payments/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
    const data = await res.json()
    setResult(data)
    setLoading(false)
    if (data.updated) router.refresh()
  }

  return (
    <div className="mt-4">
      <button
        onClick={handleReconcile}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/40 text-sm text-gray-300 hover:text-white px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
      >
        {loading ? (
          <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Procurando no MP…</>
        ) : "🔍 Procurar pagamento no Mercado Pago"}
      </button>
      {result && (
        <p className={`mt-2 text-xs text-center ${result.updated ? "text-green-400" : "text-gray-500"}`}>
          {result.message}
        </p>
      )}
    </div>
  )
}
