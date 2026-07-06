"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { fmtDateBR, fmtTimeBR, dbTime } from "@/lib/date"

const PAGE_SIZE = 50

type Order = {
  id: string
  nome: string
  email: string
  whatsapp: string
  subcategory: string
  musicalStyle: string
  status: string
  paymentStatus: string
  createdAt: string
  customer_state?: string | null
  products?: { name: string } | null
  product_delivery_options?: { label: string; days: number } | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente", IN_PRODUCTION: "Em produção", DELIVERED: "Entregue", ABANDONED: "Abandonado",
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
  IN_PRODUCTION: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  DELIVERED: "bg-green-500/15 text-green-300 border-green-500/20",
  ABANDONED: "bg-gray-500/15 text-gray-400 border-gray-500/20",
}
const PAYMENT_COLOR: Record<string, string> = {
  UNPAID: "bg-red-500/15 text-red-300", PAID: "bg-green-500/15 text-green-300", REFUNDED: "bg-gray-500/15 text-gray-400",
}

const code = (id: string) => id.slice(0, 8).toUpperCase()
const fmtDate = fmtDateBR
const fmtTime = fmtTimeBR

export default function OrdersList({ orders }: { orders: Order[] }) {
  const [search, setSearch]   = useState("")
  const [status, setStatus]   = useState("")
  const [payment, setPayment] = useState("")
  const [product, setProduct] = useState("")
  const [from, setFrom]       = useState("")
  const [to, setTo]           = useState("")

  const productOptions = useMemo(
    () => Array.from(new Set(orders.map((o) => o.products?.name).filter(Boolean))) as string[],
    [orders]
  )

  const filtered = useMemo(() => {
    const term = search.trim().replace(/^#/, "").toLowerCase()
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null
    const toTs   = to ? new Date(`${to}T23:59:59`).getTime() : null

    return orders.filter((o) => {
      if (status && o.status !== status) return false
      if (payment && o.paymentStatus !== payment) return false
      if (product && (o.products?.name ?? "") !== product) return false
      const ts = dbTime(o.createdAt)
      if (fromTs !== null && ts < fromTs) return false
      if (toTs !== null && ts > toTs) return false
      if (term) {
        const hay = [code(o.id).toLowerCase(), o.id.toLowerCase(), o.nome.toLowerCase(), o.email.toLowerCase(), o.whatsapp.toLowerCase()].join(" ")
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [orders, search, status, payment, product, from, to])

  const hasFilters = search || status || payment || product || from || to

  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [search, status, payment, product, from, to])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <>
      {/* Barra de busca + filtros */}
      <div className="bg-black/40 border border-white/10 rounded-2xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">Buscar (código #, nome, e-mail, telefone)</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ex: 4CB42FE3 ou maria@email.com"
            className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500">
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Pagamento</label>
          <select value={payment} onChange={(e) => setPayment(e.target.value)}
            className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500">
            <option value="">Todos</option>
            <option value="PAID">Pago</option>
            <option value="UNPAID">Não pago</option>
            <option value="REFUNDED">Reembolsado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Produto</label>
          <select value={product} onChange={(e) => setProduct(e.target.value)}
            className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500">
            <option value="">Todos</option>
            {productOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500 text-gray-300" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500 text-gray-300" />
        </div>
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setStatus(""); setPayment(""); setProduct(""); setFrom(""); setTo("") }}
            className="text-xs text-gray-400 hover:text-white px-3 py-2 rounded-xl border border-white/10"
          >
            Limpar
          </button>
        )}
      </div>

      <p className="text-gray-500 text-sm mb-4">
        Mostrando {filtered.length} de {orders.length} pedido{orders.length !== 1 ? "s" : ""}
      </p>

      <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
        {/* Tabela — desktop */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-500">
                <th className="text-left px-6 py-4">Cliente</th>
                <th className="text-left px-6 py-4">Contato</th>
                <th className="text-left px-6 py-4">Produto</th>
                <th className="text-left px-6 py-4">Ocasião</th>
                <th className="text-left px-6 py-4">Estilo</th>
                <th className="text-left px-6 py-4">Estado</th>
                <th className="text-left px-6 py-4">Status</th>
                <th className="text-left px-6 py-4">Pagamento</th>
                <th className="text-left px-6 py-4">Data / Hora</th>
                <th className="text-left px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-600">Nenhum pedido encontrado.</td></tr>
              )}
              {paged.map((o) => (
                <tr key={o.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium">{o.nome}</div>
                    <div className="text-pink-300/80 text-xs font-mono">#{code(o.id)}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    <div>{o.email}</div>
                    <div className="text-xs">{o.whatsapp}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-lg">
                      {o.products?.name ?? "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    <div>{o.subcategory}</div>
                    {o.product_delivery_options && (
                      <div className="text-xs text-yellow-400 mt-0.5">⏱ {o.product_delivery_options.label}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">{o.musicalStyle}</td>
                  <td className="px-6 py-4 text-gray-400 text-xs">{o.customer_state ?? "—"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${STATUS_COLOR[o.status] ?? ""}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${PAYMENT_COLOR[o.paymentStatus] ?? ""}`}>{o.paymentStatus}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    <div>{fmtDate(o.createdAt)}</div>
                    <div className="text-xs text-gray-600">{fmtTime(o.createdAt)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/admin/pedidos/${o.id}`} className="text-pink-400 hover:text-pink-300 text-xs font-medium">Ver →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cards — mobile */}
        <div className="lg:hidden divide-y divide-white/5">
          {filtered.length === 0 && (
            <p className="px-4 py-10 text-center text-gray-600 text-sm">Nenhum pedido encontrado.</p>
          )}
          {paged.map((o) => (
            <Link key={o.id} href={`/admin/pedidos/${o.id}`} className="block px-4 py-4 hover:bg-white/3 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{o.nome} <span className="text-pink-300/80 text-xs font-mono">#{code(o.id)}</span></p>
                  <span className="inline-block text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md mt-1">
                    {o.products?.name ?? "—"}
                  </span>
                  <p className="text-gray-500 text-xs mt-0.5">{o.subcategory} · {o.musicalStyle}{o.customer_state ? ` · ${o.customer_state}` : ""}</p>
                  {o.product_delivery_options && (
                    <p className="text-yellow-400 text-xs mt-0.5">⏱ {o.product_delivery_options.label}</p>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium border shrink-0 ${STATUS_COLOR[o.status] ?? ""}`}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">{o.whatsapp}</div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${PAYMENT_COLOR[o.paymentStatus] ?? ""}`}>{o.paymentStatus}</span>
                  <span className="text-gray-600 text-xs">{fmtDate(o.createdAt)} {fmtTime(o.createdAt)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Paginação */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="px-3 py-2 rounded-xl text-sm border border-white/10 text-gray-300 disabled:opacity-30 hover:bg-white/5 transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-400">Página {safePage + 1} de {pageCount}</span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            className="px-3 py-2 rounded-xl text-sm border border-white/10 text-gray-300 disabled:opacity-30 hover:bg-white/5 transition-colors"
          >
            Próxima →
          </button>
        </div>
      )}
    </>
  )
}
