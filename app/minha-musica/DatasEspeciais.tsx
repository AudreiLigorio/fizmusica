"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import InfoTooltip from "./InfoTooltip"

// Catálogo próprio de ocasiões — não é o mesmo do wizard (que tem pedido de
// casamento, luto, pets como contexto de evento único). Aqui é sempre uma
// data que se repete todo ano sobre uma pessoa (ou pet).
const OCASIOES = [
  { emoji: "🎂", label: "Aniversário" },
  { emoji: "💍", label: "Aniversário de casamento" },
  { emoji: "💕", label: "Aniversário de namoro" },
  { emoji: "🌷", label: "Dia das Mães" },
  { emoji: "👔", label: "Dia dos Pais" },
  { emoji: "👵", label: "Dia dos Avós" },
  { emoji: "🎓", label: "Formatura" },
  { emoji: "🐾", label: "Aniversário Pet" },
  { emoji: "✨", label: "Outra data especial" },
]

type SpecialDate = { id: string; nome: string; ocasiao_emoji: string; ocasiao_label: string; data: string }

function fmtDiaMes(iso: string): string {
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
  const [, mes, dia] = iso.split("-")
  return `${dia} ${MESES[Number(mes) - 1]}`
}

export default function DatasEspeciais() {
  const [dates, setDates] = useState<SpecialDate[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState("")
  const [ocasiao, setOcasiao] = useState("")
  const [data, setData] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch("/api/special-dates", {
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    })
    const d = await res.json().catch(() => ({}))
    setDates(d.dates ?? [])
  }

  useEffect(() => { load() }, [])

  function limparForm() {
    setShowForm(false); setEditingId(null)
    setNome(""); setOcasiao(""); setData("")
  }

  function editar(d: SpecialDate) {
    setEditingId(d.id)
    setNome(d.nome)
    setOcasiao(`${d.ocasiao_emoji}|${d.ocasiao_label}`)
    setData(d.data)
    setShowForm(true)
  }

  async function salvar() {
    if (!nome.trim() || !ocasiao || !data) return
    const [emoji, label] = ocasiao.split("|")
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const url = editingId ? `/api/special-dates/${editingId}` : "/api/special-dates"
    const res = await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ nome: nome.trim(), ocasiaoEmoji: emoji, ocasiaoLabel: label, data }),
    })
    setSaving(false)
    if (res.ok) {
      limparForm()
      await load()
    }
  }

  async function remover(id: string) {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/special-dates/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    })
    setDates((prev) => prev?.filter((d) => d.id !== id) ?? null)
    if (editingId === id) limparForm()
  }

  if (dates === null) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center text-base shrink-0" style={{ background: "rgba(240,25,107,0.14)" }}>📅</div>
        <h3 className="text-sm font-semibold flex-1 min-w-0 truncate">Datas especiais</h3>
        {dates.length === 0 && (
          <span className="text-[10px] font-bold uppercase tracking-wide bg-fuchsia-500 text-white px-2 py-0.5 rounded-full shrink-0">Novo</span>
        )}
        <InfoTooltip text="Cadastre no lembrete as datas especiais e ganhe bônus." />
      </div>

      {dates.length > 0 && (
        <div className="mb-1">
          {dates.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-sm shrink-0">{d.ocasiao_emoji}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.nome}</p>
                  <p className="text-xs text-white/40 truncate">{d.ocasiao_label}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-white/60 font-mono">{fmtDiaMes(d.data)}</span>
                <button onClick={() => editar(d)} className="text-white/30 hover:text-fuchsia-300 text-xs transition-colors" aria-label="Editar">✏️</button>
                <button onClick={() => remover(d.id)} className="text-white/30 hover:text-red-400 text-xs transition-colors" aria-label="Remover">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full mt-2 py-2 rounded-xl border border-dashed border-white/15 text-white/60 hover:text-white hover:border-fuchsia-500/40 text-xs transition-colors"
        >
          + Adicionar data especial
        </button>
      ) : (
        <div className="flex flex-wrap gap-2 mt-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome da pessoa"
            className="flex-1 min-w-[120px] bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-xs outline-none focus:border-fuchsia-500/50"
          />
          <select
            value={ocasiao}
            onChange={(e) => setOcasiao(e.target.value)}
            className="flex-[1.3] min-w-[160px] bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-xs outline-none focus:border-fuchsia-500/50"
          >
            <option value="" disabled>Ocasião</option>
            {OCASIOES.map((o) => (
              <option key={o.label} value={`${o.emoji}|${o.label}`}>{o.emoji} {o.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-xs outline-none focus:border-fuchsia-500/50"
          />
          <button
            onClick={salvar}
            disabled={saving || !nome.trim() || !ocasiao || !data}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40 transition-all"
            style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
          >
            {saving ? "Salvando…" : editingId ? "Salvar edição" : "Salvar"}
          </button>
          <button
            onClick={limparForm}
            className="px-3 py-2 rounded-lg text-xs font-medium text-white/50 hover:text-white transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
