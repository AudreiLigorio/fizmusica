import { z } from "zod"

export const createPaymentSchema = z.object({
  orderId:          z.string().uuid("orderId inválido"),
  productId:        z.string().min(1, "productId obrigatório"),
  productName:      z.string().min(1, "productName obrigatório"),
  price:            z.number().positive("Preço deve ser positivo"),
  deliveryOptionId: z.string().uuid("deliveryOptionId inválido").optional(),
})

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
