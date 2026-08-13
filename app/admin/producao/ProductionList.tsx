"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import MusicaForm from "./MusicaForm"
import SunoPanel from "./SunoPanel"
import PhotoEffectSelect from "./PhotoEffectSelect"
import OrderPhotosAdmin from "./OrderPhotosAdmin"
import { fmtDateBR, fmtTimeBR, dbTime } from "@/lib/date"

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
  lyricsApproved?: boolean
  lyricsDraft?: string | null
  products?: { name: string; feat_qrcode?: boolean | null } | null
  product_delivery_options?: { label: string; days: number } | null
  payments?: { mpPaymentId: string | null; mpStatus: string | null }[] | null
  revision?: { message: string; status: string; createdAt: string } | null
  is_revision?: boolean
  parent_order_id?: string | null
  revision_note?: string | null
  sunoStatus?: string | null
  sunoError?: string | null
  sunoTracks?: { audioId: string; audioUrl: string; imageUrl: string | null; title: string | null; duration: number | null }[] | null
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
const fmtDate = fmtDateBR
const fmtTime = fmtTimeBR

// Um pedido "precisa de ação" quando: cliente pediu revisão (esperando aceite),
// a geração falhou (precisa gerar de novo), ou está pronta esperando ser liberada.
function needsAction(o: Order): "revision" | "failed" | "ready" | null {
  if (o.revision) return "revision"
  if (o.sunoStatus === "FAILED") return "failed"
  if (o.sunoStatus === "READY") return "ready"
  return null
}

const ACTION_LABEL: Record<string, string> = {
  revision: "⚠️ Revisão solicitada",
  failed:   "❌ Geração falhou",
  ready:    "✅ Pronta p/ liberar",
}
const ACTION_COLOR: Record<string, string> = {
  revision: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  failed:   "bg-red-500/15 text-red-300 border-red-500/30",
  ready:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
}

export default function ProductionList({ orders }: { orders: Order[] }) {
  const [search, setSearch]   = useState("")
  const [status, setStatus]   = useState("")
  const [product, setProduct] = useState("")
  const [from, setFrom]       = useState("")
  const [to, setTo]           = useState("")
  const [onlyAction, setOnlyAction] = useState(false)
  const [page, setPage]       = useState(0)
  const [accepting, setAccepting] = useState<string | null>(null)
  // Pedidos que precisam de ação já começam expandidos — o resto, recolhido.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(orders.filter((o) => needsAction(o) !== null).map((o) => o.id))
  )

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleAcceptRevision(orderId: string) {
    setAccepting(orderId)
    try {
      const res = await fetch(`/api/admin/producao/${orderId}/aceitar-revisao`, { method: "POST" })
      const data = await res.json()
      if (data.ok) {
        window.location.reload()
      } else {
        alert(`Erro: ${data.error}`)
        setAccepting(null)
      }
    } catch (err: any) {
      alert(`Erro de conexão: ${err?.message ?? "tente novamente"}`)
      setAccepting(null)
    }
  }

  const counts = useMemo(() => ({
    PENDING:       orders.filter((o) => o.status === "PENDING").length,
    IN_PRODUCTION: orders.filter((o) => o.status === "IN_PRODUCTION").length,
    DELIVERED:     orders.filter((o) => o.status === "DELIVERED").length,
    ACTION:        orders.filter((o) => needsAction(o) !== null).length,
  }), [orders])

  const productOptions = useMemo(
    () => Array.from(new Set(orders.map((o) => o.products?.name).filter(Boolean))) as string[],
    [orders]
  )

  const filtered = useMemo(() => {
    const term = search.trim().replace(/^#/, "").toLowerCase()
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null
    const toTs   = to ? new Date(`${to}T23:59:59`).getTime() : null
    const base = orders.filter((o) => {
      if (onlyAction && needsAction(o) === null) return false
      if (status && o.status !== status) return false
      if (product && (o.products?.name ?? "") !== product) return false
      const ts = dbTime(o.createdAt)
      if (fromTs !== null && ts < fromTs) return false
      if (toTs !== null && ts > toTs) return false
      if (term) {
        const mpId = o.payments?.[0]?.mpPaymentId ?? ""
        const hay = [code(o.id).toLowerCase(), o.id.toLowerCase(), o.nome.toLowerCase(), o.email.toLowerCase(), o.whatsapp.toLowerCase(), mpId.toLowerCase()].join(" ")
        if (!hay.includes(term)) return false
      }
      return true
    })
    // Prioriza quem precisa de ação (revisão > falha > pronto) no topo; resto
    // segue a ordem cronológica original (mais antigo primeiro).
    const ACTION_WEIGHT: Record<string, number> = { revision: 0, failed: 1, ready: 2 }
    const weight = (o: Order) => ACTION_WEIGHT[needsAction(o) ?? ""] ?? 3
    return [...base].sort((a, b) => weight(a) - weight(b))
  }, [orders, search, status, product, from, to, onlyAction])

  useEffect(() => { setPage(0) }, [search, status, product, from, to, onlyAction])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const hasFilters = search || status || product || from || to || onlyAction

  return (
    <>
      {/* RESUMO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
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
        <button
          onClick={() => setOnlyAction((v) => !v)}
          className={`rounded-2xl p-5 text-center border transition-all ${
            onlyAction
              ? "bg-orange-500/15 border-orange-500/50"
              : counts.ACTION > 0
                ? "bg-orange-500/5 border-orange-500/30 hover:border-orange-500/50"
                : "bg-black/40 border-white/10"
          }`}
        >
          <p className={`text-3xl font-bold ${counts.ACTION > 0 ? "text-orange-400" : "text-gray-600"}`}>{counts.ACTION}</p>
          <p className="text-gray-400 text-sm mt-1">⚠️ Precisa de ação</p>
        </button>
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
          <button onClick={() => { setSearch(""); setStatus(""); setProduct(""); setFrom(""); setTo(""); setOnlyAction(false) }}
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
        <div className="space-y-3">
          {paged.map((order) => {
            const mpId = order.payments?.[0]?.mpPaymentId ?? null
            const action = needsAction(order)
            const isOpen = expanded.has(order.id)
            return (
              <div key={order.id} className={`rounded-2xl border overflow-hidden ${
                order.revision
                  ? "bg-orange-500/5 border-orange-500/40 shadow-[0_0_24px_rgba(249,115,22,0.1)]"
                  : order.is_revision
                    ? "bg-fuchsia-500/5 border-fuchsia-500/40 shadow-[0_0_24px_rgba(217,70,239,0.1)]"
                    : "bg-black/40 border-white/10"
              }`}>
                {/* Linha-resumo — sempre visível, clicável pra expandir/recolher */}
                <button
                  onClick={() => toggleExpanded(order.id)}
                  className="w-full flex items-start justify-between gap-3 p-4 lg:p-5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-gray-600 shrink-0 transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "none" }}>▸</span>
                      <p className="font-semibold">{order.nome}</p>
                      {order.is_revision && (
                        <span className="text-xs px-2 py-0.5 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300 font-semibold">REVISÃO</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[order.status] ?? ""}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                      {action && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${ACTION_COLOR[action]}`}>
                          {ACTION_LABEL[action]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate pl-5">
                      {order.products?.name ?? "—"} · {order.subcategory} · {order.musicalStyle}
                    </p>
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <p className="text-pink-300/90 font-mono">#{code(order.id)}</p>
                    <p className="text-gray-500 mt-0.5">{fmtDate(order.createdAt)}</p>
                  </div>
                </button>

                {!isOpen ? null : (
                <div className="px-4 pb-6 lg:px-6 lg:pb-6 -mt-1">
                {/* Banner: revisão solicitada pelo cliente (pedido original) */}
                {order.revision && (
                  <div className="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-orange-400 font-bold text-xs uppercase tracking-wider">⚠️ Revisão solicitada pelo cliente</span>
                      <span className="text-orange-400/50 text-xs">{fmtDateBR(order.revision.createdAt)} {fmtTimeBR(order.revision.createdAt)}</span>
                    </div>
                    <p className="text-orange-200 text-sm leading-relaxed whitespace-pre-wrap mb-3">{order.revision.message}</p>
                    <button
                      onClick={() => handleAcceptRevision(order.id)}
                      disabled={accepting === order.id}
                      className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                      {accepting === order.id ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Criando pedido de revisão…
                        </>
                      ) : "✅ Aceitar revisão (criar novo pedido)"}
                    </button>
                  </div>
                )}
                {/* Banner: este é um pedido de revisão (duplicado) */}
                {order.is_revision && order.revision_note && (
                  <div className="mb-4 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-3">
                    <p className="text-fuchsia-300 font-bold text-xs uppercase tracking-wider mb-1">✏️ Pedido de revisão — ajustar conforme pedido do cliente</p>
                    <p className="text-fuchsia-200 text-sm leading-relaxed whitespace-pre-wrap">{order.revision_note}</p>
                  </div>
                )}
                {/* Cabeçalho */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
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

                {/* Música por IA (Suno) — gerar/ouvir/liberar versões */}
                <SunoPanel orderId={order.id} status={order.sunoStatus ?? null} tracks={order.sunoTracks ?? null} error={order.sunoError ?? null} />

                {/* Form de produção */}
                <MusicaForm orderId={order.id} honoreeName={order.honoreeName ?? null} lyricsDraft={order.lyricsDraft ?? null} mostrarQr={order.products?.feat_qrcode !== false} />
                </div>
                )}
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
