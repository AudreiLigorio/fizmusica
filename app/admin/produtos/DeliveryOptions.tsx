"use client"

import { useEffect, useState } from "react"

type Option = {
  id: string
  label: string
  days: number
  price_extra: number
  sort_order: number
  active: boolean
}

export default function DeliveryOptions({ productId }: { productId: string }) {
  const [options, setOptions] = useState<Option[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Option | null>(null)
  const [form, setForm] = useState({ label: "", days: 5, price_extra: 0, sort_order: 0 })
  const [saving, setSaving] = useState(false)
  const [bulking, setBulking] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/admin/produtos/${productId}/delivery`)
    const data = await res.json()
    setOptions(data.options ?? [])
    setLoading(false)
  }

  // Carrega no mount pro interruptor mestre já saber o estado (sem abrir o painel).
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  const hasOptions = options.length > 0
  const anyActive  = options.some((o) => o.active)

  // Interruptor mestre: liga/desliga TODAS as opções de uma vez. Sem nenhuma
  // opção ativa, o cliente compra em 1 clique (a /produtos pula a etapa de prazo).
  async function toggleAll() {
    setBulking(true)
    await fetch(`/api/admin/produtos/${productId}/delivery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !anyActive }),
    })
    await load()
    setBulking(false)
  }

  function startNew() {
    setEditing(null)
    setForm({ label: "", days: 5, price_extra: 0, sort_order: (options.length + 1) })
  }

  function startEdit(opt: Option) {
    setEditing(opt)
    setForm({ label: opt.label, days: opt.days, price_extra: opt.price_extra, sort_order: opt.sort_order })
  }

  async function handleSave() {
    setSaving(true)
    if (editing) {
      await fetch(`/api/admin/produtos/${productId}/delivery/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
    } else {
      await fetch(`/api/admin/produtos/${productId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
    }
    setEditing(null)
    setForm({ label: "", days: 5, price_extra: 0, sort_order: 0 })
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta opção?")) return
    await fetch(`/api/admin/produtos/${productId}/delivery/${id}`, { method: "DELETE" })
    await load()
  }

  async function toggleActive(opt: Option) {
    await fetch(`/api/admin/produtos/${productId}/delivery/${opt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !opt.active }),
    })
    await load()
  }

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setOpen(!open)}
          className="text-sm text-gray-400 hover:text-pink-400 transition-colors flex items-center gap-2"
        >
          <span>⏱</span>
          {open ? "Fechar prazos" : "Gerenciar prazos de entrega"}
          <span className="text-xs">{open ? "▲" : "▼"}</span>
        </button>

        {/* Interruptor mestre: prazos ativos vs. compra em 1 clique */}
        {hasOptions ? (
          <button
            onClick={toggleAll}
            disabled={bulking}
            title={anyActive
              ? "Desativar todos os prazos — o cliente compra em 1 clique"
              : "Reativar os prazos de entrega"}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
              anyActive
                ? "border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20"
                : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20"
            }`}
          >
            {bulking ? "…" : anyActive ? "🟢 Prazos ON · desativar" : "⚡ 1 clique · ativar prazos"}
          </button>
        ) : (
          <span className="text-xs text-gray-500">⚡ Compra em 1 clique (sem prazos)</span>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-xs text-gray-500">Carregando...</p>
          ) : (
            <>
              {options.map((opt) => (
                <div
                  key={opt.id}
                  className={`flex items-center justify-between bg-black/30 rounded-xl p-3 border ${opt.active ? "border-white/10" : "border-white/5 opacity-50"}`}
                >
                  {editing?.id === opt.id ? (
                    <div className="flex-1 grid grid-cols-4 gap-2 mr-3">
                      <input
                        value={form.label}
                        onChange={(e) => setForm({ ...form, label: e.target.value })}
                        placeholder="Label"
                        className="col-span-2 bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-pink-500"
                      />
                      <input
                        type="number"
                        value={form.days}
                        onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
                        placeholder="Dias"
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-pink-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={form.price_extra}
                        onChange={(e) => setForm({ ...form, price_extra: Number(e.target.value) })}
                        placeholder="Acréscimo"
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-pink-500"
                      />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-gray-500">
                        {opt.days} dias úteis
                        {opt.price_extra > 0 ? ` · +R$ ${Number(opt.price_extra).toFixed(2).replace(".", ",")}` : " · Sem acréscimo"}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {editing?.id === opt.id ? (
                      <>
                        <button onClick={handleSave} disabled={saving} className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50">
                          {saving ? "..." : "Salvar"}
                        </button>
                        <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:text-white">
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => toggleActive(opt)} className={`text-xs ${opt.active ? "text-gray-500 hover:text-yellow-400" : "text-gray-600 hover:text-green-400"}`}>
                          {opt.active ? "Desativar" : "Ativar"}
                        </button>
                        <button onClick={() => startEdit(opt)} className="text-xs text-gray-500 hover:text-blue-400">
                          Editar
                        </button>
                        <button onClick={() => handleDelete(opt.id)} className="text-xs text-gray-500 hover:text-red-400">
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Formulário de novo */}
              {!editing && (
                <div className="bg-black/20 rounded-xl p-3 border border-dashed border-white/10">
                  <p className="text-xs text-gray-500 mb-2">Nova opção</p>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    <input
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value })}
                      placeholder="Ex: Normal (5 dias)"
                      className="col-span-2 bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-pink-500"
                    />
                    <input
                      type="number"
                      value={form.days}
                      onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
                      placeholder="Dias"
                      className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-pink-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={form.price_extra}
                      onChange={(e) => setForm({ ...form, price_extra: Number(e.target.value) })}
                      placeholder="Acréscimo"
                      className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-pink-500"
                    />
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={!form.label || saving}
                    className="text-xs bg-pink-500/20 text-pink-300 border border-pink-500/20 px-3 py-1.5 rounded-lg hover:bg-pink-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? "Salvando..." : "+ Adicionar opção"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
