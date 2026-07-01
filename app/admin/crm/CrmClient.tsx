"use client"

import { useState, useEffect } from "react"
import { dbTime } from "@/lib/date"

// ── Types ──────────────────────────────────────────────────────

type UnpaidOrder = {
  id: string
  nome: string
  email: string
  whatsapp: string
  subcategory: string
  musicalStyle: string
  createdAt: string
  status: string
  recoveryCount: number
}

type InsightRow = { name: string; total: number; paid: number; rate: number }
type Insights   = { occasions: InsightRow[]; styles: InsightRow[]; voices: InsightRow[]; emotions: InsightRow[] }

type Feedback = {
  id:          string
  orderId:     string
  rating:      number
  highlight:   string
  improvement: string | null
  submittedAt: string
  nome:        string
  subcategory: string
  musicalStyle:string
}

// ── Helpers ────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - dbTime(dateStr)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(h / 24)
  if (d > 0) return `há ${d} dia${d > 1 ? "s" : ""}`
  if (h > 0) return `há ${h}h`
  return "agora pouco"
}

function Stars({ rating, size = "text-base" }: { rating: number; size?: string }) {
  return (
    <span className={size}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ filter: n <= rating ? "none" : "grayscale(1) opacity(0.25)" }}>⭐</span>
      ))}
    </span>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function InsightTable({ title, col, rows }: { title: string; col: string; rows: InsightRow[] }) {
  const maxTotal = rows[0]?.total ?? 1
  return (
    <div>
      <h2 className="text-base font-semibold mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">Sem dados ainda.</p>
      ) : (
        <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-500 text-xs">
                <th className="text-left px-5 py-3">{col}</th>
                <th className="text-center px-4 py-3">Pedidos</th>
                <th className="text-center px-4 py-3">Pagos</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell w-40">Volume</th>
                <th className="text-center px-4 py-3">Conversão</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.name} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs w-4 shrink-0">{i + 1}</span>
                      <span className="font-medium">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">{row.total}</td>
                  <td className="px-4 py-3 text-center text-green-400 font-medium">{row.paid}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 transition-all"
                        style={{ width: `${Math.round((row.total / maxTotal) * 100)}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                      row.rate >= 60 ? "bg-green-500/15 text-green-400" :
                      row.rate >= 30 ? "bg-yellow-500/15 text-yellow-400" :
                      "bg-red-500/15 text-red-400"
                    }`}>{row.rate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RecoveryCard({
  order, sent, sending, errors, onSend, badge,
}: {
  order: UnpaidOrder
  sent: Record<string, boolean>
  sending: Record<string, boolean>
  errors: Record<string, string>
  onSend: (id: string) => void
  badge: "auto" | null
}) {
  return (
    <div className="bg-black/40 border border-white/10 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold">{order.nome}</p>
            <span className="text-xs text-gray-500 font-mono">#{order.id.slice(0, 8).toUpperCase()}</span>
            {badge === "auto" && (
              <span className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                📧 e-mail automático enviado
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">{order.email} · {order.whatsapp}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-gray-300">{order.subcategory}</span>
            <span className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-gray-300">{order.musicalStyle}</span>
            <span className="text-xs text-gray-500">{timeAgo(order.createdAt)}</span>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          {sent[order.id] ? (
            <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg">✅ Enviado</span>
          ) : (
            <button
              onClick={() => onSend(order.id)}
              disabled={sending[order.id]}
              className="text-xs bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {sending[order.id] ? (
                <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Enviando…</>
              ) : badge === "auto" ? "📧 Reenviar" : "📧 Enviar recuperação"}
            </button>
          )}
          {errors[order.id] && <p className="text-xs text-red-400">{errors[order.id]}</p>}
          <a href={`https://wa.me/${order.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
            className="text-xs text-green-400 hover:text-green-300 transition-colors">💬 WhatsApp</a>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

export default function CrmClient({
  unpaidOrders,
  abandonedOrders,
  insights,
  feedbacks,
}: {
  unpaidOrders:    UnpaidOrder[]
  abandonedOrders: UnpaidOrder[]
  insights:        Insights
  feedbacks:       Feedback[]
}) {
  const [tab, setTab] = useState<"recovery" | "mass" | "insights" | "ratings">("recovery")

  // ── Repescagem (pedidos) ──
  const [sending, setSending] = useState<Record<string, boolean>>({})
  const [sent, setSent]       = useState<Record<string, boolean>>({})
  const [errors, setErrors]   = useState<Record<string, string>>({})

  // ── Leads do wizard abandonados ──
  type WizardLead = { id: string; nome: string; email: string; subcategory: string; musicalStyle: string; updatedAt: string }
  const [wizardLeads, setWizardLeads]           = useState<WizardLead[] | null>(null)
  const [wizardLoading, setWizardLoading]       = useState(false)
  const [wizardSending, setWizardSending]       = useState(false)
  const [wizardResult, setWizardResult]         = useState<{ enviados: number; falhas: number } | null>(null)

  async function loadWizardLeads() {
    setWizardLoading(true)
    const res = await fetch("/api/admin/wizard-recovery?horas=2")
    const data = await res.json()
    setWizardLeads(data.leads ?? [])
    setWizardLoading(false)
  }

  async function handleWizardRecovery() {
    setWizardSending(true)
    const res = await fetch("/api/admin/wizard-recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ horasMin: 2 }),
    })
    const data = await res.json()
    setWizardResult({ enviados: data.enviados, falhas: data.falhas })
    setWizardLeads(null) // recarrega
    setWizardSending(false)
  }

  async function handleRecovery(orderId: string) {
    setSending(s => ({ ...s, [orderId]: true }))
    setErrors(e => ({ ...e, [orderId]: "" }))
    const res  = await fetch("/api/admin/crm/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
    const data = await res.json()
    if (data.ok) { setSent(s => ({ ...s, [orderId]: true })) }
    else { setErrors(e => ({ ...e, [orderId]: data.error ?? "Erro desconhecido" })) }
    setSending(s => ({ ...s, [orderId]: false }))
  }

  // ── E-mail em massa ──
  const [audience, setAudience]   = useState<"paid" | "all">("paid")
  const [subject, setSubject]     = useState("")
  const [body, setBody]           = useState("")
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [massLoading, setMassLoading] = useState(false)
  const [massResult, setMassResult]   = useState<{ sent: number; failed: number; errors: string[] } | null>(null)
  const [massError, setMassError]     = useState("")

  useEffect(() => {
    fetch(`/api/admin/crm/mass-email?audience=${audience}`)
      .then(r => r.json()).then(d => setRecipientCount(d.count))
  }, [audience])

  async function handleMassEmail() {
    if (!subject.trim() || !body.trim()) return
    setMassLoading(true); setMassResult(null); setMassError("")
    const res  = await fetch("/api/admin/crm/mass-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience, subject, body }),
    })
    const data = await res.json()
    if (data.error) { setMassError(data.error) }
    else { setMassResult(data); setSubject(""); setBody("") }
    setMassLoading(false)
  }

  // ── Avaliações — stats ──
  const avgRating = feedbacks.length > 0
    ? (feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(1)
    : null

  const ratingDist = [5, 4, 3, 2, 1].map(n => ({
    stars: n,
    count: feedbacks.filter(f => f.rating === n).length,
  }))

  const totalRecovery = unpaidOrders.length + abandonedOrders.length

  return (
    <div className="p-4 lg:p-8 max-w-5xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">CRM</h1>
      <p className="text-gray-500 text-sm mb-6">Recuperação de clientes, campanhas e avaliações</p>

      {/* Abas */}
      <div className="flex gap-1 mb-6 border-b border-white/10 overflow-x-auto">
        {[
          { key: "recovery",  label: "🔄 Repescagem",     badge: totalRecovery > 0 ? totalRecovery : null },
          { key: "ratings",   label: "⭐ Avaliações",      badge: feedbacks.length > 0 ? feedbacks.length : null },
          { key: "insights",  label: "📊 Análises",        badge: null },
          { key: "mass",      label: "📧 E-mail em massa", badge: null },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 whitespace-nowrap ${
              tab === t.key ? "border-pink-500 text-pink-400" : "border-transparent text-gray-500 hover:text-white"
            }`}>
            {t.label}
            {t.badge !== null && (
              <span className="bg-pink-500 text-white text-xs px-1.5 py-0.5 rounded-full">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── ABA REPESCAGEM ── */}
      {tab === "recovery" && (
        <div className="space-y-6">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-yellow-300">
            ⚡ E-mails de recuperação são enviados <strong>automaticamente a cada 2 horas</strong> para pedidos sem pagamento. Você também pode enviar manualmente abaixo.
          </div>

          {totalRecovery === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-4xl mb-4">🎉</p>
              <p>Nenhum pedido pendente nos últimos 7 dias.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {unpaidOrders.length > 0 && (
                <div>
                  <p className="text-xs text-yellow-400 uppercase tracking-wider mb-3 font-medium">
                    ⏳ Aguardando envio automático — {unpaidOrders.length} pedido{unpaidOrders.length > 1 ? "s" : ""}
                  </p>
                  <div className="space-y-3">
                    {unpaidOrders.map(o => (
                      <RecoveryCard key={o.id} order={o} sent={sent} sending={sending} errors={errors} onSend={handleRecovery} badge={null} />
                    ))}
                  </div>
                </div>
              )}
              {abandonedOrders.length > 0 && (
                <div>
                  <p className="text-xs text-blue-400 uppercase tracking-wider mb-3 font-medium">
                    📧 E-mail automático já enviado — {abandonedOrders.length} pedido{abandonedOrders.length > 1 ? "s" : ""}
                  </p>
                  <div className="space-y-3">
                    {abandonedOrders.map(o => (
                      <RecoveryCard key={o.id} order={o} sent={sent} sending={sending} errors={errors} onSend={handleRecovery} badge="auto" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LEADS DO WIZARD ── (dentro da aba recovery) */}
      {tab === "recovery" && (
        <div className="mt-8 border-t border-white/10 pt-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-white">🎵 Leads do wizard abandonados</p>
              <p className="text-xs text-gray-500 mt-0.5">Pessoas que informaram e-mail no formulário mas não finalizaram o pedido</p>
            </div>
            <button
              onClick={loadWizardLeads}
              disabled={wizardLoading}
              className="text-xs px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:border-pink-500 hover:text-white transition-colors disabled:opacity-50"
            >
              {wizardLoading ? "Carregando…" : "🔍 Ver leads elegíveis"}
            </button>
          </div>

          {wizardResult && (
            <div className="mb-4 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-300">
              ✅ {wizardResult.enviados} e-mail{wizardResult.enviados !== 1 ? "s" : ""} enviado{wizardResult.enviados !== 1 ? "s" : ""}
              {wizardResult.falhas > 0 && ` · ${wizardResult.falhas} falha${wizardResult.falhas !== 1 ? "s" : ""}`}
            </div>
          )}

          {wizardLeads !== null && (
            wizardLeads.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum lead elegível no momento (abandono &gt; 2h sem e-mail enviado).</p>
            ) : (
              <div className="space-y-3">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-blue-300 flex items-center justify-between gap-4 flex-wrap">
                  <span>{wizardLeads.length} lead{wizardLeads.length !== 1 ? "s" : ""} elegível{wizardLeads.length !== 1 ? "s" : ""} — e-mail com link de retomada</span>
                  <button
                    onClick={handleWizardRecovery}
                    disabled={wizardSending}
                    className="text-xs bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    {wizardSending ? (
                      <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Enviando…</>
                    ) : `📧 Disparar para todos (${wizardLeads.length})`}
                  </button>
                </div>
                {wizardLeads.map(lead => (
                  <div key={lead.id} className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm">{lead.nome}</p>
                      <p className="text-xs text-gray-400">{lead.email}</p>
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        {lead.subcategory && <span className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-300">{lead.subcategory}</span>}
                        {lead.musicalStyle && <span className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-300">{lead.musicalStyle}</span>}
                        <span className="text-xs text-gray-600">{timeAgo(lead.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* ── ABA AVALIAÇÕES ── */}
      {tab === "ratings" && (
        <div className="space-y-6">
          {feedbacks.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-4xl mb-4">⭐</p>
              <p>Nenhuma avaliação recebida ainda.</p>
              <p className="text-sm mt-2">As avaliações aparecem aqui quando os clientes respondem após a entrega.</p>
            </div>
          ) : (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold text-pink-400">{avgRating}</p>
                  <p className="text-xs text-gray-500 mt-1">Nota média</p>
                  <Stars rating={Math.round(Number(avgRating))} size="text-sm" />
                </div>
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold">{feedbacks.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Avaliações</p>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-400">
                    {Math.round((feedbacks.filter(f => f.rating >= 4).length / feedbacks.length) * 100)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Satisfeitos (4–5⭐)</p>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold text-yellow-400">
                    {feedbacks.filter(f => f.improvement).length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Com sugestão</p>
                </div>
              </div>

              {/* Distribuição de estrelas */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-5">
                <p className="text-sm font-medium mb-4">Distribuição das notas</p>
                <div className="space-y-2">
                  {ratingDist.map(({ stars, count }) => (
                    <div key={stars} className="flex items-center gap-3">
                      <span className="text-sm w-6 text-right text-gray-400">{stars}</span>
                      <span className="text-sm">⭐</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 transition-all"
                          style={{ width: feedbacks.length > 0 ? `${Math.round((count / feedbacks.length) * 100)}%` : "0%" }} />
                      </div>
                      <span className="text-xs text-gray-500 w-6">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lista de feedbacks */}
              <div className="space-y-4">
                {feedbacks.map(f => (
                  <div key={f.id} className="bg-black/40 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{f.nome}</p>
                          <Stars rating={f.rating} />
                        </div>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <span className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-400">{f.subcategory}</span>
                          <span className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-400">{f.musicalStyle}</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">{timeAgo(f.submittedAt)}</span>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-green-500/5 border border-green-500/15 rounded-xl px-4 py-3">
                        <p className="text-xs text-green-400 font-medium mb-1">💬 O que encantou</p>
                        <p className="text-sm text-gray-300 leading-relaxed">{f.highlight}</p>
                      </div>
                      {f.improvement && (
                        <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl px-4 py-3">
                          <p className="text-xs text-yellow-400 font-medium mb-1">🔧 Sugestão de melhoria</p>
                          <p className="text-sm text-gray-300 leading-relaxed">{f.improvement}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ABA ANÁLISES ── */}
      {tab === "insights" && (
        <div className="space-y-8">
          <InsightTable title="🎯 Subcategorias mais pedidas" col="Subcategoria" rows={insights.occasions} />
          <InsightTable title="🎵 Estilos musicais"           col="Estilo"       rows={insights.styles}    />
          <InsightTable title="🎤 Tipo de voz"                col="Voz"          rows={insights.voices}    />
          <InsightTable title="💫 Emoção da música"           col="Emoção"       rows={insights.emotions}  />
          <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-2">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> ≥ 60% — ótimo</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 30–59% — médio</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> &lt; 30% — baixo</span>
          </div>
        </div>
      )}

      {/* ── ABA E-MAIL EM MASSA ── */}
      {tab === "mass" && (
        <div className="space-y-5">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-5">
            <label className="text-xs text-gray-500 mb-3 block font-medium uppercase tracking-wider">Destinatários</label>
            <div className="flex gap-3">
              {[
                { value: "paid", label: "Clientes que pagaram", desc: "Apenas quem concluiu pelo menos 1 pedido" },
                { value: "all",  label: "Todos os cadastros",   desc: "Todos que iniciaram um pedido" },
              ].map(opt => (
                <button key={opt.value} onClick={() => setAudience(opt.value as "paid" | "all")}
                  className={`flex-1 text-left p-4 rounded-xl border transition-all ${
                    audience === opt.value ? "border-pink-500/50 bg-pink-500/10 text-white" : "border-white/10 bg-black/20 text-gray-400 hover:border-white/20"
                  }`}>
                  <p className="text-sm font-medium mb-0.5">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </button>
              ))}
            </div>
            {recipientCount !== null && (
              <p className="text-sm text-pink-400 mt-3">📬 <strong>{recipientCount}</strong> destinatário{recipientCount !== 1 ? "s" : ""} únicos</p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Assunto do e-mail</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Ex: Promoção especial — 20% OFF na sua próxima música 🎵"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-500 transition-colors" />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Mensagem</label>
            <textarea rows={8} value={body} onChange={e => setBody(e.target.value)}
              placeholder={"Escreva sua mensagem aqui...\n\nDica: o e-mail já inclui o nome do cliente no início e o botão 'Visitar FizMusica' no final."}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-500 transition-colors resize-none" />
            <p className="text-xs text-gray-600 mt-1">{body.length} caracteres</p>
          </div>

          {massError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">❌ {massError}</div>
          )}
          {massResult && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400 space-y-1">
              <p>✅ <strong>{massResult.sent}</strong> e-mails enviados com sucesso</p>
              {massResult.failed > 0 && (
                <p className="text-yellow-400">⚠️ {massResult.failed} falha{massResult.failed > 1 ? "s" : ""}
                  {massResult.errors.length > 0 && `: ${massResult.errors.slice(0, 3).join(", ")}`}</p>
              )}
            </div>
          )}

          <button onClick={handleMassEmail} disabled={massLoading || !subject.trim() || !body.trim()}
            className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium text-sm transition-colors flex items-center gap-2">
            {massLoading ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enviando para {recipientCount} destinatários…</>
            ) : <>📧 Enviar para {recipientCount ?? "..."} clientes</>}
          </button>
        </div>
      )}
    </div>
  )
}
