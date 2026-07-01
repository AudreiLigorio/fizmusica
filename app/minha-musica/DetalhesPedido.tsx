"use client"

import { useState } from "react"
import { fmtDateTimeBR } from "@/lib/date"

function maskEmail(email?: string): string {
  if (!email) return ""
  const [local, domain] = email.split("@")
  if (!domain) return "•••"
  const l = local.length <= 2 ? local[0] + "•" : local[0] + "•••" + local[local.length - 1]
  const [host, ...tldParts] = domain.split(".")
  const tld = tldParts.length ? "." + tldParts.join(".") : ""
  const h = host.length <= 1 ? host : host[0] + "•••"
  return `${l}@${h}${tld}`
}

function maskPhone(phone?: string): string {
  if (!phone) return ""
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 4) return "•••"
  const last2 = digits.slice(-2)
  const ddd = digits.length >= 10 ? `(${digits.slice(0, 2)}) ` : ""
  return `${ddd}•••••-••${last2}`
}

type Order = {
  id: string
  nome?: string
  email?: string
  whatsapp?: string
  context: string
  subcategory: string
  musicalStyle?: string
  voiceType?: string
  emotion?: string
  honoreeName?: string | null
  createdAt: string
  products?: { name: string; price: number } | null
  payments?: { amount: number; mpStatus: string | null; paidAt?: string | null } | null
  answers?: { question: string; answer: string; position: number }[]
  shipping_name?: string | null
  shipping_cep?: string | null
  shipping_address?: string | null
  shipping_number?: string | null
  shipping_complement?: string | null
  shipping_neighborhood?: string | null
  shipping_city?: string | null
  shipping_state?: string | null
  shipping_phone?: string | null
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-white/40 text-xs shrink-0">{label}</span>
      <span className="text-white/80 text-xs text-right">{value}</span>
    </div>
  )
}

// Resumo do que o cliente preencheu — expansível dentro do card do pedido.
export default function DetalhesPedido({ order }: { order: Order }) {
  const [revealed, setRevealed] = useState(false)
  const hasShipping = !!(order.shipping_address || order.shipping_cep)
  const valor = order.payments?.amount ?? order.products?.price

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-1 space-y-4">
      {/* Sobre a música */}
      <div>
        <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-1.5">🎵 Sua música</p>
        <Row label="Para quem é" value={order.honoreeName ?? undefined} />
        <Row label="Ocasião" value={order.subcategory} />
        <Row label="Estilo musical" value={order.musicalStyle} />
        <Row label="Tipo de voz" value={order.voiceType} />
        <Row label="Emoção" value={order.emotion} />
      </div>

      {/* Respostas do wizard */}
      {order.answers && order.answers.length > 0 && (
        <div>
          <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-1.5">📝 O que você nos contou</p>
          <div className="space-y-2">
            {order.answers.map((a, i) => (
              <div key={i} className="bg-black/20 rounded-lg px-3 py-2">
                <p className="text-white/40 text-[11px] mb-0.5">{a.question}</p>
                <p className="text-white/80 text-xs whitespace-pre-wrap leading-relaxed">{a.answer || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Produto e pagamento */}
      <div>
        <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-1.5">🛍️ Pedido</p>
        <Row label="Produto" value={order.products?.name} />
        <Row label="Valor" value={valor != null ? `R$ ${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : undefined} />
        <Row label="Pedido feito em" value={fmtDateTimeBR(order.createdAt)} />
        <Row label="Pagamento confirmado em" value={order.payments?.paidAt ? fmtDateTimeBR(order.payments.paidAt) : undefined} />
        <Row label="Código do pedido" value={`#${order.id.slice(0, 8).toUpperCase()}`} />
      </div>

      {/* Endereço de entrega (produto físico) */}
      {hasShipping && (
        <div>
          <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-1.5">📦 Entrega</p>
          <Row label="Destinatário" value={order.shipping_name} />
          <Row label="Endereço" value={[order.shipping_address, order.shipping_number].filter(Boolean).join(", ")} />
          <Row label="Complemento" value={order.shipping_complement} />
          <Row label="Bairro" value={order.shipping_neighborhood} />
          <Row label="Cidade/UF" value={[order.shipping_city, order.shipping_state].filter(Boolean).join(" / ")} />
          <Row label="CEP" value={order.shipping_cep} />
          <Row label="Telefone" value={order.shipping_phone} />
        </div>
      )}

      {/* Dados cadastrais */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider">👤 Seus dados</p>
          {(order.email || order.whatsapp) && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="text-white/40 hover:text-white/70 text-[11px] flex items-center gap-1 transition-colors"
            >
              {revealed ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7a11 11 0 01-2.3 3.3M6.5 6.6A11.4 11.4 0 003 12c0 2.5 4 7 9 7a9.6 9.6 0 003.7-.74" /></svg>
                  Ocultar
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="2.5" /></svg>
                  Mostrar
                </>
              )}
            </button>
          )}
        </div>
        <Row label="Nome" value={order.nome} />
        <Row label="E-mail" value={order.email ? (revealed ? order.email : maskEmail(order.email)) : undefined} />
        <Row label="WhatsApp" value={order.whatsapp ? (revealed ? order.whatsapp : maskPhone(order.whatsapp)) : undefined} />
      </div>

      <p className="text-white/30 text-[11px] leading-relaxed pt-1">
        Algo errado? Fale com a gente pelo WhatsApp informando o código do pedido.
      </p>
    </div>
  )
}
