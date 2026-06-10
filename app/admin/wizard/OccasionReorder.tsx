"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Controle de ordenação de ocasiões — totalmente isolado.
 * Usa o endpoint PATCH existente (/api/admin/wizard/ocasioes/[id]) que já aceita sort_order.
 * Ao mover, normaliza o sort_order de todas as ocasiões para índices sequenciais (0,1,2…),
 * garantindo ordem consistente mesmo se os valores originais estiverem nulos ou duplicados.
 */
export default function OccasionReorder({
  occasions,
  index,
}: {
  occasions: { id: string }[]
  index: number
}) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  const total = occasions.length

  async function move(direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= total || busy) return
    setBusy(true)

    // Nova ordem com os dois itens trocados
    const reordered = [...occasions]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]

    // Persiste o sort_order = posição para cada item que mudou
    await Promise.all(
      reordered.map((o, i) => {
        const original = occasions[i]
        if (original.id === o.id) return null // não mudou de posição
        return fetch(`/api/admin/wizard/ocasioes/${o.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: i }),
        })
      }).filter(Boolean) as Promise<Response>[]
    )

    setBusy(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-0.5 mr-1">
      <button
        onClick={() => move(-1)}
        disabled={index === 0 || busy}
        title="Mover para cima"
        className="w-6 h-5 flex items-center justify-center rounded-md text-gray-500 hover:text-pink-400 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-xs leading-none"
      >
        ▲
      </button>
      <button
        onClick={() => move(1)}
        disabled={index === total - 1 || busy}
        title="Mover para baixo"
        className="w-6 h-5 flex items-center justify-center rounded-md text-gray-500 hover:text-pink-400 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-xs leading-none"
      >
        ▼
      </button>
    </div>
  )
}
