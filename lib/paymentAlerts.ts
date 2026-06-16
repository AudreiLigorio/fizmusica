import { createServerClient } from "@/lib/supabase"
import { sendDuplicatePaymentAlert } from "@/app/services/emailService"

type SB = ReturnType<typeof createServerClient>

/**
 * Detecta possível pagamento duplicado: já existe um pagamento PAID para o pedido
 * com um mpPaymentId DIFERENTE do que está chegando agora.
 * Quando detecta: registra alerta em `payment_alerts`, avisa o admin por e-mail
 * e retorna true (o chamador deve NÃO sobrescrever o pagamento original).
 */
export async function detectDuplicatePayment(
  supabase: SB,
  orderId: string,
  newMpPaymentId: string,
  amount?: number | null,
): Promise<boolean> {
  const { data: existing } = await supabase
    .from("payments")
    .select("mpPaymentId, status")
    .eq("orderId", orderId)
    .maybeSingle()

  const prevId = existing?.mpPaymentId ?? null
  const isDuplicate =
    existing?.status === "PAID" && !!prevId && !!newMpPaymentId && prevId !== newMpPaymentId

  if (!isDuplicate) return false

  // Evita registrar o mesmo alerta repetidas vezes (webhook reentrante)
  const { data: already } = await supabase
    .from("payment_alerts")
    .select("id")
    .eq("orderId", orderId)
    .eq("mpPaymentId", newMpPaymentId)
    .maybeSingle()

  if (already) return true

  const { data: order } = await supabase
    .from("orders").select("nome").eq("id", orderId).maybeSingle()

  await supabase.from("payment_alerts").insert({
    orderId,
    type: "DUPLICATE_PAYMENT",
    mpPaymentId: newMpPaymentId,
    previousMpPaymentId: prevId,
    amount: amount ?? null,
    message: "Pagamento aprovado recebido para pedido já pago, com ID diferente.",
  })

  await sendDuplicatePaymentAlert({
    orderId,
    nome: order?.nome,
    mpPaymentId: newMpPaymentId,
    previousMpPaymentId: prevId!,
    amount: amount ?? undefined,
  })

  console.warn(`[payment-alert] possível duplicidade no pedido ${orderId}: novo ${newMpPaymentId} vs ${prevId}`)
  return true
}
