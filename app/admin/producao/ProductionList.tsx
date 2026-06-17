"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import MusicaForm from "./MusicaForm"
import PhotoEffectSelect from "./PhotoEffectSelect"
import OrderPhotosAdmin from "./OrderPhotosAdmin"

type Order = {
  id: string
  nome: string
  email: string
  whatsapp: string
  subcategory: string
  musicalStyle: string
  voiceType: string
  emotion: string
  honoreeName: string | null
  status: string
  createdAt: string
  photo_effect?: string | null
  products?: { name: string } | null
  product_delivery_options?: { label: string; days: number } | null
  payments?: { mpPaymentId: string | null; mpStatus: string | null }[] | null
}

const PAGE_SIZE = 30

const STATUS_COLOR: Record<string, string> = {
  PENDING:       "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  IN_PRODUCTION: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  DELIVERED:     "bg-green-500/10 text-green-400 border-green-500/20",
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Aguardando", IN_PRODUCTION: "Em produção", DELIVERED: "Entregue",
}

const code = (id: string) => id.slice(0, 8).toUpperCase()
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })

export default function ProductionList({ orders }: { orders: Order[] }) {
  const [search, setSearch]   = useState("")
  const [status, setStatus]   = useState("")
  const [product, setProduct] = useState("")
  const [from, setFrom]       = useState("")
  const [to, setTo]           = useState("")
  const [page, setPage]       = useState(0)

  const counts = useMemo(() => ({
    PENDING:       orders.filter((o) => o.status === "PENDING").length,
    IN_PRODUCTION: orders.filter((o) => o.status === "IN_PRODUCTION").length,
    DELIVERED:     orders.filter((o) => o.status === "DELIVERED").length,
  }), [orders])

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
      if (product && (o.products?.name ?? "") !== product) return false
      const ts = new Date(o.createdAt).getTime()
      if (fromTs !== null && ts < fromTs) return false
      if (toTs !== null && ts > toTs) return false
      if (term) {
        const mpId = o.payments?.[0]?.mpPaymentId ?? ""
        const hay = [code(o.id).toLowerCase(), o.id.toLowerCase(), o.nome.toLowerCase(), o.email.toLowerCase(), o.whatsapp.toLowerCase(), mpId.toLowerCase()].join(" ")
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [orders, search, status, product, from, to])

  useEffect(() => { setPage(0) }, [search, status, product, from, to])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const hasFilters = search || status || product || from || to

  return (
    <>
      {/* RESUMO */}
      <div className="grid grid-cols-3 gap-3 lg:gap-4 mb-6">
        {[
          { label: "Aguardando",  count: counts.PENDING,       color: "text-yellow-400" },
          { label: "Em produção", count: counts.IN_PRODUCTION, color: "text-blue-400"   },
          { label: "Entregues",   count: counts.DELIVERED,     color: "text-green-400"  },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-black/40 border border-white/10 rounded-2xl p-5 text-center">
            <p className={`text-3xl font-bold ${color}`}>{count}</p>
            <p className="text-gray-500 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div className="bg-black/40 border border-white/10 rounded-2xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">Buscar (código #, ID pagamento, nome, e-mail, telefone)</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Ex: 32161701 ou 1234567890"
            className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Etapa</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500">
            <option value="">Todas</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
          <button onClick={() => { setSearch(""); setStatus(""); setProduct(""); setFrom(""); setTo("") }}
            className="text-xs text-gray-400 hover:text-white px-3 py-2 rounded-xl border border-white/10">Limpar</button>
        )}
      </div>

      <p className="text-gray-500 text-sm mb-4">Mostrando {filtered.length} de {orders.length} pedido{orders.length !== 1 ? "s" : ""}</p>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-4">🎵</p>
          <p>Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paged.map((order) => {
            const mpId = order.payments?.[0]?.mpPaymentId ?? null
            return (
              <div key={order.id} className="bg-black/40 border border-white/10 rounded-2xl p-6">
                {/* Cabeçalho */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-semibold">{order.nome}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[order.status] ?? ""}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{order.email} · {order.whatsapp}</p>
                    {order.honoreeName && (
                      <p className="text-xs text-pink-400 mt-0.5">🎁 Para: {order.honoreeName}</p>
                    )}
                    {order.product_delivery_options && (
                      <p className="text-xs text-yellow-400 mt-0.5">
                        ⏱ Prazo: {order.product_delivery_options.label} ({order.product_delivery_options.days} dias úteis)
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <p className="text-pink-300/90 font-mono">#{code(order.id)}</p>
                    <p className="text-gray-500 mt-0.5">{fmtDate(order.createdAt)}</p>
                    <p className="text-gray-600">{fmtTime(order.createdAt)}</p>
                    {mpId && (
                      <a
                        href={`https://www.mercadopago.com.br/activities/1/detail?id=${mpId}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:underline mt-1 block font-mono"
                        title="Abrir transação no Mercado Pago"
                      >
                        MP: {mpId} ↗
                      </a>
                    )}
                    <Link href={`/admin/pedidos/${order.id}`} className="text-blue-400 hover:underline mt-1 block">Ver pedido →</Link>
                  </div>
                </div>

                {/* Briefing */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    { label: "Produto", value: order.products?.name },
                    { label: "Ocasião", value: order.subcategory },
                    { label: "Estilo",  value: order.musicalStyle },
                    { label: "Voz",     value: order.voiceType },
                    { label: "Emoção",  value: order.emotion },
                  ].map(({ label, value }) => value && (
                    <span key={label} className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-gray-300">
                      <span className="text-gray-500">{label}:</span> {value}
                    </span>
                  ))}
                </div>

                {/* Fotos do cliente — gerenciáveis pelo admin */}
                <div className="mb-4 bg-black/20 border border-white/10 rounded-xl p-4">
                  <OrderPhotosAdmin orderId={order.id} />
                  <PhotoEffectSelect orderId={order.id} current={order.photo_effect ?? "slide"} />
                </div>

                {/* Form de produção */}
                <MusicaForm orderId={order.id} honoreeName={order.honoreeName ?? null} nome={order.nome} />
              </div>
            )
          })}
        </div>
      )}

      {/* Paginação */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}
            className="px-3 py-2 rounded-xl text-sm border border-white/10 text-gray-300 disabled:opacity-30 hover:bg-white/5 transition-colors">← Anterior</button>
          <span className="text-sm text-gray-400">Página {safePage + 1} de {pageCount}</span>
          <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}
            className="px-3 py-2 rounded-xl text-sm border border-white/10 text-gray-300 disabled:opacity-30 hover:bg-white/5 transition-colors">Próxima →</button>
        </div>
      )}
    </>
  )
}
