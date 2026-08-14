import { z } from "zod"

export const answerSchema = z.object({
  question:    z.string().min(1),
  answer:      z.string().min(1),
  position:    z.number().int().nonnegative(),
  context:     z.string().min(1),
  subcategory: z.string().min(1),
})

export const createOrderSchema = z.object({
  nome:         z.string().min(2, "Nome obrigatório"),
  email:        z.email("E-mail inválido"),
  whatsapp:     z.string().min(10, "WhatsApp inválido").max(20),
  context:      z.string().min(1, "Ocasião obrigatória"),
  subcategory:  z.string().min(1, "Subcategoria obrigatória"),
  musicalStyle: z.string().min(1, "Estilo musical obrigatório"),
  voiceType:    z.string().min(1, "Tipo de voz obrigatório"),
  emotion:      z.string().min(1, "Emoção obrigatória"),
  answers:      z.array(answerSchema).min(1, "Respostas obrigatórias"),
  honoreeName:  z.string().optional(),
  // Sessão do wizard: usada só pra reaproveitar a letra da prévia como rascunho
  // inicial do pedido, e apenas se a assinatura do conteúdo ainda bater.
  sessionId:    z.string().optional(),
  // Consentimento (prova LGPD)
  termsAccepted:  z.boolean().optional(),
  termsVersion:   z.string().optional(),
  honoreeConsent: z.boolean().optional(),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
