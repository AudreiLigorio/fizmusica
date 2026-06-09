"use client"

import { useState, useEffect } from "react"

type UnpaidOrder = {
  id: string
  nome: string
  email: string
  whatsapp: string
  subcategory: string
  musicalStyle: string
  createdAt: string
  recoveryCount: number
}

export default function CrmClient({ unpaidOrders }: { unpaidOrders: UnpaidOrder[] }) {
  const [tab, setTab] = useState<"recovery" | "mass">("recovery")

  // ── Repescagem ──
  const [sending, setSending] = useState<Record<string, boolean>>({})
  const [sent, setSent]       = useState<Record<string, boolean>>({})
  const [errors, setErrors]   = useState<Record<string, string>>({})

  async function handleRecovery(orderId: string) {
    setSending(s => ({ ...s, [orderId]: true }))
    setErrors(e => ({ ...e, [orderId]: "" }))
    const res  = await fetch("/api/admin/crm/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
    const data = await res.json()
    if (data.ok) {
      setSent(s => ({ ...s, [orderId]: true }))
    } else {
      setErrors(e => ({ ...e, [orderId]: data.error ?? "Erro desconhecido" }))
    }
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
      .then(r => r.json())
      .then(d => setRecipientCount(d.count))
  }, [audience])

  async function handleMassEmail() {
    if (!subject.trim() || !body.trim()) return
    setMassLoading(true)
    setMassResult(null)
    setMassError("")
    const res  = await fetch("/api/admin/crm/mass-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience, subject, body }),
    })
    const data = await res.json()
    if (data.error) {
      setMassError(data.error)
    } else {
      setMassResult(data)
      setSubject("")
      setBody("")
    }
    setMassLoading(false)
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(h / 24)
    if (d > 0) return `há ${d} dia${d > 1 ? "s" : ""}`
    if (h > 0) return `há ${h}h`
    return "agora pouco"
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">CRM</h1>
      <p className="text-gray-500 text-sm mb-6">Recuperação de clientes e campanhas de e-mail</p>

      {/* Abas */}
      <div className="flex gap-2 mb-6 border-b border-white/10">
        <button
          onClick={() => setTab("recovery")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "recovery"
              ? "border-pink-500 text-pink-400"
              : "border-transparent text-gray-500 hover:text-white"
          }`}
        >
          🔄 Repescagem
          {unpaidOrders.length > 0 && (
            <span className="ml-2 bg-pink-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {unpaidOrders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("mass")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "mass"
              ? "border-pink-500 text-pink-400"
              : "border-transparent text-gray-500 hover:text-white"
          }`}
        >
          📧 E-mail em massa
        </button>
      </div>

      {/* ── ABA REPESCAGEM ── */}
      {tab === "recovery" && (
        <div>
          <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-yellow-300">
            ⚠️ Pedidos com pagamento pendente há mais de 1 hora. Envie um e-mail de recuperação para aumentar a conversão.
          </div>

          {unpaidOrders.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-4xl mb-4">🎉</p>
              <p>Nenhum pedido pendente no momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unpaidOrders.map(order => (
                <div key={order.id} className="bg-black/40 border border-white/10 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">{order.nome}</p>
                        <span className="text-xs text-gray-500 font-mono">#{order.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                      <p className="text-xs text-gray-400">{order.email} · {order.whatsapp}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-gray-300">
                          {order.subcategory}
                        </span>
                        <span className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-gray-300">
                          {order.musicalStyle}
                        </span>
                        <span className="text-xs text-gray-500">{timeAgo(order.createdAt)}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      {sent[order.id] ? (
                        <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg">
                          ✅ E-mail enviado
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRecovery(order.id)}
                          disabled={sending[order.id]}
                          className="text-xs bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                          {sending[order.id] ? (
                            <>
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Enviando…
                            </>
                          ) : "📧 Enviar recuperação"}
                        </button>
                      )}
                      {errors[order.id] && (
                        <p className="text-xs text-red-400">{errors[order.id]}</p>
                      )}
                      <a
                        href={`https://wa.me/${order.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-400 hover:text-green-300 transition-colors"
                      >
                        💬 WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ABA E-MAIL EM MASSA ── */}
      {tab === "mass" && (
        <div className="space-y-5">

          {/* Audiência */}
          <div className="bg-black/40 border border-white/10 rounded-2xl p-5">
            <label className="text-xs text-gray-500 mb-3 block font-medium uppercase tracking-wider">Destinatários</label>
            <div className="flex gap-3">
              {[
                { value: "paid", label: "Clientes que pagaram", desc: "Apenas quem concluiu pelo menos 1 pedido" },
                { value: "all",  label: "Todos os cadastros",   desc: "Todos que iniciaram um pedido" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAudience(opt.value as "paid" | "all")}
                  className={`flex-1 text-left p-4 rounded-xl border transition-all ${
                    audience === opt.value
                      ? "border-pink-500/50 bg-pink-500/10 text-white"
                      : "border-white/10 bg-black/20 text-gray-400 hover:border-white/20"
                  }`}
                >
                  <p className="text-sm font-medium mb-0.5">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </button>
              ))}
            </div>
            {recipientCount !== null && (
              <p className="text-sm text-pink-400 mt-3">
                📬 <strong>{recipientCount}</strong> destinatário{recipientCount !== 1 ? "s" : ""} únicos
              </p>
            )}
          </div>

          {/* Assunto */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Assunto do e-mail</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ex: Promoção especial — 20% OFF na sua próxima música 🎵"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-500 transition-colors"
            />
          </div>

          {/* Corpo */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Mensagem</label>
            <textarea
              rows={8}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Escreva sua mensagem aqui...

Dica: o e-mail já inclui automaticamente o nome do cliente no início e o botão 'Visitar FizMusica' no final."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-500 transition-colors resize-none"
            />
            <p className="text-xs text-gray-600 mt-1">{body.length} caracteres</p>
          </div>

          {/* Feedback */}
          {massError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              ❌ {massError}
            </div>
          )}
          {massResult && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400 space-y-1">
              <p>✅ <strong>{massResult.sent}</strong> e-mails enviados com sucesso</p>
              {massResult.failed > 0 && (
                <p className="text-yellow-400">⚠️ {massResult.failed} falha{massResult.failed > 1 ? "s" : ""}
                  {massResult.errors.length > 0 && `: ${massResult.errors.slice(0, 3).join(", ")}`}
                </p>
              )}
            </div>
          )}

          {/* Botão enviar */}
          <button
            onClick={handleMassEmail}
            disabled={massLoading || !subject.trim() || !body.trim()}
            className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
          >
            {massLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando para {recipientCount} destinatários…
              </>
            ) : (
              <>📧 Enviar para {recipientCount ?? "..."} clientes</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
