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
export interface N8nOrderWebhookPayload {
  event: "order.created" | "music.delivered"
  orderId: string
  nome: string
  whatsapp: string
  email: string
  context: string
  subcategory: string
  musicalStyle: string
  voiceType: string
  emotion: string
  answers: AnswerDTO[]
  createdAt: string
  publicUrl?: string
  musicName?: string
}
