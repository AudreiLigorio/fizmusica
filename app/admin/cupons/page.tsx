"use client"

import { useEffect, useState } from "react"
import { fmtDateBR } from "@/lib/date"

type Coupon = {
  id: string
  code: string
  type: "PERCENT" | "FIXED"
  value: number
  min_value: number | null
  max_uses: number | null
  used_count: number
  active: boolean
  expires_at: string | null
  show_on_site: boolean
  description: string | null
}

const emptyForm = {
  code: "", type: "PERCENT" as "PERCENT" | "FIXED", value: "",
  min_value: "", max_uses: "", expires_at: "", description: "", show_on_site: false,
}

export default function CuponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({ ...emptyForm })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState("")

  async function load() {
    const d = await fetch("/api/admin/cupons", { cache: "no-store" }).then((r) => r.json())
    setCoupons(d.coupons ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError("")
    const res = await fetch("/api/admin/cupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        value: Number(form.value),
        min_value: form.min_value ? Number(form.min_value) : null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        expires_at: form.expires_at || null,
      }),
    })
    const d = await res.json()
    setSaving(false)
    if (res.ok) { setForm({ ...emptyForm }); load() }
    else setError(d.error ?? "Erro ao criar.")
  }

  async function toggle(id: string, field: "active" | "show_on_site", value: boolean) {
    await fetch("/api/admin/cupons", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: value }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm("Excluir este cupom?")) return
    await fetch("/api/admin/cupons", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    load()
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Cupons</h1>
      <p className="text-gray-500 text-sm mb-8">Crie cupons de desconto para as jornadas de venda e repescagem</p>

      {/* Criar cupom */}
      <form onSubmit={create} className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-8">
        <h2 className="font-semibold mb-4">Novo cupom</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Código <span className="text-gray-600">(vazio = gera automático)</span></label>
            <input
              value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="EX: NATAL20"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-pink-500 uppercase"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Tipo de desconto</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({ ...form, type: "PERCENT" })}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${form.type === "PERCENT" ? "border-pink-500 bg-pink-500/10 text-pink-300" : "border-white/10 text-gray-400"}`}>
                Percentual (%)
              </button>
              <button type="button" onClick={() => setForm({ ...form, type: "FIXED" })}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${form.type === "FIXED" ? "border-pink-500 bg-pink-500/10 text-pink-300" : "border-white/10 text-gray-400"}`}>
                Valor fixo (R$)
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1.5">{form.type === "PERCENT" ? "Desconto (%)" : "Desconto (R$)"}</label>
            <input type="number" min={1} step="0.01" required
              value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-pink-500" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Pedido mínimo (R$) <span className="text-gray-600">opcional</span></label>
            <input type="number" min={0} step="0.01"
              value={form.min_value} onChange={(e) => setForm({ ...form, min_value: e.target.value })}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-pink-500" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Máx. de usos <span className="text-gray-600">vazio = ilimitado</span></label>
            <input type="number" min={1}
              value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-pink-500" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Expira em <span className="text-gray-600">opcional</span></label>
            <input type="date"
              value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-pink-500" />
          </div>
        </div>

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={form.show_on_site} onChange={(e) => setForm({ ...form, show_on_site: e.target.checked })} className="w-4 h-4 accent-pink-500" />
          <span className="text-sm text-gray-300">Exibir banner do cupom na página de produtos</span>
        </label>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button disabled={saving} className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          {saving ? "Criando…" : "Criar cupom"}
        </button>
      </form>

      {/* Lista */}
      {loading ? (
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      ) : coupons.length === 0 ? (
        <p className="text-gray-600 text-sm">Nenhum cupom criado ainda.</p>
      ) : (
        <div className="space-y-3">
          {coupons.map((c) => {
            const expired = c.expires_at && new Date(c.expires_at).getTime() < Date.now()
            const exhausted = c.max_uses != null && c.used_count >= c.max_uses
            return (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-black/40 p-5 flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-lg text-pink-300">{c.code}</span>
                    <span className="text-sm text-gray-300">
                      {c.type === "PERCENT" ? `${Number(c.value)}% OFF` : `R$ ${Number(c.value).toFixed(2)} OFF`}
                    </span>
                    {!c.active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">inativo</span>}
                    {expired && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">expirado</span>}
                    {exhausted && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400">esgotado</span>}
                    {c.show_on_site && <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300">no site</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Usos: {c.used_count}{c.max_uses != null ? `/${c.max_uses}` : ""}
                    {c.min_value != null ? ` · mín R$ ${Number(c.min_value).toFixed(2)}` : ""}
                    {c.expires_at ? ` · expira ${fmtDateBR(c.expires_at)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(c.id, "active", !c.active)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors">
                    {c.active ? "Desativar" : "Ativar"}
                  </button>
                  <button onClick={() => toggle(c.id, "show_on_site", !c.show_on_site)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors">
                    {c.show_on_site ? "Tirar do site" : "Pôr no site"}
                  </button>
                  <button onClick={() => remove(c.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
                    Excluir
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
