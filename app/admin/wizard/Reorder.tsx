"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Controle genérico de ordenação (setas ▲▼) para listas do wizard.
 * Usa o PATCH do recurso (que já aceita sort_order) e normaliza o sort_order
 * para índices sequenciais (0,1,2…), garantindo ordem consistente mesmo com
 * valores nulos/duplicados.
 *
 * `endpointBase` é o caminho sem o id, ex: "/api/admin/wizard/subcategorias".
 */
export default function Reorder({
  items,
  index,
  endpointBase,
}: {
  items: { id: string }[]
  index: number
  endpointBase: string
}) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const total = items.length

  async function move(direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= total || busy) return
    setBusy(true)

    const reordered = [...items]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]

    await Promise.all(
      reordered
        .map((o, i) => {
          if (items[i].id === o.id) return null // não mudou de posição
          return fetch(`${endpointBase}/${o.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sort_order: i }),
          })
        })
        .filter(Boolean) as Promise<Response>[]
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
