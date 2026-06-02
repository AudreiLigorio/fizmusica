"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Product = {
  id: string
  name: string
  description: string | null
  price: number
  active: boolean
  featured: boolean
}

export default function ProductForm({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(product.name)
  const [description, setDescription] = useState(product.description ?? "")
  const [price, setPrice] = useState(String(product.price))
  const [active, setActive] = useState(product.active)
  const [featured, setFeatured] = useState(product.featured)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const handleSave = async () => {
    setSaving(true)
    await fetch(`/api/admin/produtos/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, price: Number(price), active, featured }),
    })
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-gray-500 hover:text-white border border-white/10 hover:border-white/30 px-4 py-2 rounded-xl transition-all shrink-0"
      >
        Editar
      </button>
    )
  }

  return (
    <div className="w-full mt-4 border-t border-white/10 pt-4 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Preço (R$)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500 resize-none"
        />
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-pink-500" />
          Ativo
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="accent-pink-500" />
          Destaque
        </label>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-white px-4 py-2 rounded-xl border border-white/10 transition-all">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm bg-pink-500 hover:bg-pink-600 disabled:opacity-40 px-5 py-2 rounded-xl font-semibold transition-all"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  )
}
