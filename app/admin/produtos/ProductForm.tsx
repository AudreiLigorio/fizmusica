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
  category?: string | null
  weight_g?: number | null
  height_cm?: number | null
  width_cm?: number | null
  length_cm?: number | null
  photo_limit?: number | null
}

export default function ProductForm({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(product.name)
  const [description, setDescription] = useState(product.description ?? "")
  const [price, setPrice] = useState(String(product.price))
  const [active, setActive] = useState(product.active)
  const [featured, setFeatured] = useState(product.featured)
  const [category, setCategory] = useState<"DIGITAL" | "DIGITAL_PHYSICAL">(
    product.category === "DIGITAL_PHYSICAL" ? "DIGITAL_PHYSICAL" : "DIGITAL"
  )
  const [weightG, setWeightG]     = useState(String(product.weight_g ?? ""))
  const [heightCm, setHeightCm]   = useState(String(product.height_cm ?? ""))
  const [widthCm, setWidthCm]     = useState(String(product.width_cm ?? ""))
  const [lengthCm, setLengthCm]   = useState(String(product.length_cm ?? ""))
  const [photoLimit, setPhotoLimit] = useState(String(product.photo_limit ?? 10))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const router = useRouter()

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/produtos/${product.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setFeedback({ ok: false, msg: data.error ?? "Erro ao excluir." })
        setConfirmDelete(false)
      } else {
        window.location.reload()
      }
    } catch {
      setFeedback({ ok: false, msg: "Falha de conexão." })
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/produtos/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description, price: Number(price), active, featured, category,
          photo_limit: photoLimit ? Number(photoLimit) : 10,
          ...(category === "DIGITAL_PHYSICAL" ? {
            weight_g:  weightG  ? Number(weightG)  : null,
            height_cm: heightCm ? Number(heightCm) : null,
            width_cm:  widthCm  ? Number(widthCm)  : null,
            length_cm: lengthCm ? Number(lengthCm) : null,
          } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setFeedback({ ok: false, msg: data.error ?? "Erro ao salvar." })
      } else {
        setFeedback({ ok: true, msg: "Salvo com sucesso!" })
        setTimeout(() => window.location.reload(), 800)
      }
    } catch {
      setFeedback({ ok: false, msg: "Falha de conexão." })
    } finally {
      setSaving(false)
    }
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
        <label className="text-xs text-gray-500 mb-1 block">Limite de fotos</label>
        <input
          type="number" min="0"
          value={photoLimit}
          onChange={(e) => setPhotoLimit(e.target.value)}
          className="w-full md:w-40 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
        />
        <p className="text-[11px] text-gray-600 mt-1">Quantas fotos o cliente pode enviar para este produto. A capa gerada pela IA não conta neste limite.</p>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Categoria do produto</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as "DIGITAL" | "DIGITAL_PHYSICAL")}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
        >
          <option value="DIGITAL">Produto digital</option>
          <option value="DIGITAL_PHYSICAL">Produto digital e físico</option>
        </select>
      </div>
      {category === "DIGITAL_PHYSICAL" && (
        <div className="border border-white/10 rounded-xl p-4 space-y-3 bg-white/3">
          <p className="text-xs text-gray-400 font-medium">📦 Dimensões físicas (para cálculo de frete)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Peso (g)</label>
              <input
                type="number" min="1" value={weightG}
                onChange={(e) => setWeightG(e.target.value)}
                placeholder="ex: 500"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Altura (cm)</label>
              <input
                type="number" min="1" value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="ex: 10"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Largura (cm)</label>
              <input
                type="number" min="1" value={widthCm}
                onChange={(e) => setWidthCm(e.target.value)}
                placeholder="ex: 15"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Comprimento (cm)</label>
              <input
                type="number" min="1" value={lengthCm}
                onChange={(e) => setLengthCm(e.target.value)}
                placeholder="ex: 20"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>
          </div>
        </div>
      )}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
        <p className="text-[11px] text-gray-600 mb-1.5">Separe os itens com <span className="text-pink-400 font-mono">+</span> para virarem uma lista com ✓ na loja. Use <span className="text-pink-400 font-mono">{"{fotos}"}</span> para inserir o limite de fotos deste produto (definido no campo abaixo) — atualiza sozinho, sem editar o texto. Ex.: <span className="text-gray-500">Música exclusiva + {"{fotos}"} fotos + Player 50 dias</span></p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
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
      {feedback && (
        <p className={`text-xs px-1 ${feedback.ok ? "text-green-400" : "text-red-400"}`}>
          {feedback.ok ? "✅ " : "❌ "}{feedback.msg}
        </p>
      )}
      <div className="flex gap-3 justify-between items-center">
        {/* Excluir */}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/50 px-3 py-2 rounded-xl transition-all"
          >
            🗑 Excluir
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Tem certeza?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-semibold transition-all"
            >
              {deleting ? "Excluindo…" : "Confirmar"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 transition-all"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Salvar / Cancelar */}
        <div className="flex gap-3">
          <button onClick={() => { setOpen(false); setConfirmDelete(false) }} className="text-sm text-gray-500 hover:text-white px-4 py-2 rounded-xl border border-white/10 transition-all">
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
    </div>
  )
}
