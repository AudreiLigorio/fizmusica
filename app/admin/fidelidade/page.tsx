"use client"

import { useEffect, useState } from "react"

type Nivel = {
  id: number
  nome: string
  icone: string
  min_discos: number
  desconto_digital: number
  desconto_fisico: number
  ativo: boolean
}
type Produto = {
  id: string
  name: string
  category: string
  price: number
  active: boolean
  loyalty_discos: number
}
type Resumo = {
  clientes: number
  discosDistribuidos: number
  porNivel: Record<string, number>
  porOrigem: Record<string, number>
}

const ORIGEM_LABEL: Record<string, string> = {
  PURCHASE_DIGITAL: "Compra digital",
  PURCHASE_PHYSICAL: "Compra física",
  REFERRAL_CONVERTED: "Indicação convertida",
  REFUND: "Estorno",
  ADMIN_ADJUST: "Ajuste manual",
}

export default function FidelidadePage() {
  const [niveis, setNiveis] = useState<Nivel[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(true)
  // Chave composta (tipo:id) pra "Salvar" de nível e de produto não
  // disputarem o mesmo estado de "salvando".
  const [salvando, setSalvando] = useState<string | null>(null)
  const [msg, setMsg] = useState("")

  async function load() {
    const d = await fetch("/api/admin/fidelidade", { cache: "no-store" }).then((r) => r.json())
    setNiveis(d.niveis ?? [])
    setProdutos(d.produtos ?? [])
    setResumo(d.resumo ?? null)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function salvarProduto(p: Produto) {
    setSalvando(`produto:${p.id}`); setMsg("")
    const res = await fetch("/api/admin/fidelidade", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produtoId: p.id, discos: p.loyalty_discos }),
    })
    const d = await res.json().catch(() => ({}))
    setSalvando(null)
    if (d.error) { setMsg(d.error); return }
    setMsg("Salvo ✓")
    setTimeout(() => setMsg(""), 2000)
    load()
  }

  function editarProduto(id: string, discos: number) {
    setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, loyalty_discos: discos } : p)))
  }

  async function salvar(n: Nivel) {
    setSalvando(`nivel:${n.id}`); setMsg("")
    const res = await fetch("/api/admin/fidelidade", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: n.id,
        nome: n.nome,
        minDiscos: n.min_discos,
        descontoDigital: n.desconto_digital,
        descontoFisico: n.desconto_fisico,
        ativo: n.ativo,
      }),
    })
    const d = await res.json().catch(() => ({}))
    setSalvando(null)
    if (d.error) { setMsg(d.error); return }
    setMsg("Salvo ✓")
    setTimeout(() => setMsg(""), 2000)
    load()
  }

  function editar(id: number, campo: keyof Nivel, valor: string | number | boolean) {
    setNiveis((prev) => prev.map((n) => (n.id === id ? { ...n, [campo]: valor } : n)))
  }

  if (loading) return <p className="text-gray-400 text-sm">Carregando…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Fidelidade — Minha Carreira</h1>
        <p className="text-sm text-gray-400">
          Faixas e descontos valem na hora, sem deploy. O desconto do nível não acumula
          com cupom — vale o maior dos dois.
        </p>
      </div>

      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card titulo="Clientes no programa" valor={String(resumo.clientes)} />
          <Card titulo="Discos distribuídos" valor={String(resumo.discosDistribuidos)} />
          {Object.entries(resumo.porOrigem).map(([k, v]) => (
            <Card key={k} titulo={ORIGEM_LABEL[k] ?? k} valor={String(v)} />
          ))}
        </div>
      )}

      {resumo && Object.keys(resumo.porNivel).length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold text-gray-300 mb-3">Clientes por nível</p>
          <div className="space-y-2">
            {Object.entries(resumo.porNivel).map(([nome, qtd]) => (
              <div key={nome} className="flex items-center gap-3">
                <span className="text-sm w-52 shrink-0">{nome}</span>
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((qtd / Math.max(1, resumo.clientes)) * 100)}%`,
                      background: "linear-gradient(90deg,#f0196b,#d946ef)",
                    }}
                  />
                </div>
                <span className="text-sm font-mono w-8 text-right">{qtd}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-300">Discos por produto</p>
          {msg && <span className="text-xs text-green-400">{msg}</span>}
        </div>
        <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
          Cada plano rende o número de discos que você definir aqui — é o que estimula o
          cliente a subir de plano em vez de todos renderem o mesmo. Ordenado por preço,
          pra facilitar ver se a escada de discos acompanha a escada de valor.
        </p>

        <div className="space-y-2">
          {produtos.map((p) => (
            <div key={p.id} className={`grid grid-cols-12 gap-2 items-center border-b border-white/5 pb-2.5 ${!p.active ? "opacity-40" : ""}`}>
              <div className="col-span-6 min-w-0">
                <p className="text-sm truncate">{p.name}</p>
                <p className="text-[10px] text-gray-500">
                  R$ {p.price.toFixed(2).replace(".", ",")} · {p.category}{!p.active && " · inativo"}
                </p>
              </div>
              <label className="col-span-4 flex items-center gap-1.5 justify-end">
                <span className="text-[10px] text-gray-500 shrink-0">💿 discos</span>
                <input
                  type="number" min={0} value={p.loyalty_discos}
                  onChange={(e) => editarProduto(p.id, Number(e.target.value))}
                  className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-sm text-center outline-none focus:border-pink-500"
                />
              </label>
              <button
                onClick={() => salvarProduto(p)}
                disabled={salvando === `produto:${p.id}`}
                className="col-span-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 rounded-lg py-2 text-xs font-semibold transition-colors"
              >
                {salvando === `produto:${p.id}` ? "…" : "Salvar"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-300">Níveis</p>
          {msg && <span className="text-xs text-green-400">{msg}</span>}
        </div>

        <div className="space-y-3">
          {niveis.map((n) => (
            <div key={n.id} className="grid grid-cols-12 gap-2 items-center border-b border-white/5 pb-3">
              <span className="col-span-1 text-lg text-center">{n.icone}</span>
              <input
                value={n.nome}
                onChange={(e) => editar(n.id, "nome", e.target.value)}
                className="col-span-4 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
              <label className="col-span-2 flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500 shrink-0">a partir de</span>
                <input
                  type="number" min={0} value={n.min_discos}
                  onChange={(e) => editar(n.id, "min_discos", Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-sm outline-none focus:border-pink-500"
                />
              </label>
              <label className="col-span-2 flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500 shrink-0">digital %</span>
                <input
                  type="number" min={0} max={100} value={n.desconto_digital}
                  onChange={(e) => editar(n.id, "desconto_digital", Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-sm outline-none focus:border-pink-500"
                />
              </label>
              <label className="col-span-2 flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500 shrink-0">físico %</span>
                <input
                  type="number" min={0} max={100} value={n.desconto_fisico}
                  onChange={(e) => editar(n.id, "desconto_fisico", Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-sm outline-none focus:border-pink-500"
                />
              </label>
              <button
                onClick={() => salvar(n)}
                disabled={salvando === `nivel:${n.id}`}
                className="col-span-1 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 rounded-lg py-2 text-xs font-semibold transition-colors"
              >
                {salvando === `nivel:${n.id}` ? "…" : "Salvar"}
              </button>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
          O piso de cada nível é o número de discos a partir do qual ele vale. Mudar
          uma faixa reposiciona os clientes na hora — o nível é sempre derivado do
          saldo, nunca gravado em cada cliente.
        </p>
      </div>
    </div>
  )
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] text-gray-400 mb-1">{titulo}</p>
      <p className="text-2xl font-bold">{valor}</p>
    </div>
  )
}
