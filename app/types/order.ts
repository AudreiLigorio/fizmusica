// ============================================================
// DTOs e tipos do domínio FizMusica
// ============================================================

export type OrderStatus = "PENDING" | "IN_PRODUCTION" | "DELIVERED" | "ABANDONED"
export type PaymentStatus = "UNPAID" | "PAID" | "REFUNDED"

// Payload enviado pelo formulário /criar
export interface CreateOrderDTO {
  // Contato
  nome: string
  email: string
  whatsapp: string

  // Contexto
  context: string
  subcategory: string

  // Preferências
  musicalStyle: string
  voiceType: string
  emotion: string

  // Respostas dinâmicas
  answers: AnswerDTO[]

  // Homenageado
  honoreeName?: string

  // Sessão do wizard — só pra reaproveitar a letra da prévia como rascunho.
  sessionId?: string

  // Consentimento (prova LGPD)
  termsAccepted?: boolean
  termsVersion?: string
  honoreeConsent?: boolean
}

export interface AnswerDTO {
  question: string
  answer: string
  position: number
  context: string
  subcategory: string
}

// Resposta da API após criar pedido
export interface CreateOrderResponse {
  success: boolean
  orderId?: string
  error?: string
}

// Produto para exibição
export interface ProductDTO {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  featured: boolean
}

// Payload do webhook n8n
// Contrato externo: o workflow do n8n faz switch por `event` e usa `whatsappE164`
// para chamar a API do WhatsApp Business. Mudar campo aqui = mudar o workflow lá.
export type N8nEvent =
  | "order.created"
  | "payment.confirmed"
  | "music.delivered"
  | "feedback.request"

export interface N8nOrderWebhookPayload {
  event: N8nEvent
  orderId: string
  nome: string
  whatsapp: string
  /** Só dígitos, com DDI 55 — formato que a API do WhatsApp aceita. */
  whatsappE164: string
  email: string
  subcategory: string
  musicalStyle: string
  createdAt: string
  // Campos do wizard — só vão no order.created/payment.confirmed.
  context?: string
  voiceType?: string
  emotion?: string
  answers?: AnswerDTO[]
  // Entrega / feedback.
  publicUrl?: string
  musicName?: string
  feedbackUrl?: string
}
