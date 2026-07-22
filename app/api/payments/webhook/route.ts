import { NextResponse } from "next/server"
import MercadoPago, { Payment } from "mercadopago"
import { createServerClient } from "@/lib/supabase"
import { sendNewOrderPaidNotification } from "@/app/services/emailService"
import { ensurePaymentPrep } from "@/lib/payments/prep"
import { triggerN8nWebhook } from "@/app/services/orderService"
import { toE164 } from "@/lib/n8n/events"
import { detectDuplicatePayment } from "@/lib/paymentAlerts"

const client = new MercadoPago({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // MP envia type "payment" com o ID do pagamento
    if (body.type !== "payment" || !body.data?.id) {
      return NextResponse.json({ received: true })
    }

    const paymentId = String(body.data.id)
    const paymentClient = new Payment(client)
    const payment = await paymentClient.get({ id: paymentId })

    const orderId = payment.external_reference
    const status = payment.status // approved | pending | rejected

    if (!orderId) {
      return NextResponse.json({ received: true })
    }

    const supabase = createServerClient()

    // Anti-duplicidade: pagamento aprovado para pedido já pago, com ID diferente
    if (status === "approved") {
      const dup = await detectDuplicatePayment(supabase, orderId, paymentId, payment.transaction_amount)
      if (dup) {
        // Não sobrescreve o pagamento original; alerta já foi registrado/enviado
        return NextResponse.json({ received: true, duplicate: true })
      }
    }

    // Produto vinculado a ESTE pagamento (reconciliação Fix 3): o pedido deve
    // refletir o que foi efetivamente pago, não o que a última tela gravou.
    const { data: paidRow } = await supabase
      .from("payments")
      .select("productId, deliveryOptionId")
      .eq("mpPaymentId", paymentId)
      .maybeSingle()

    // Salva/atualiza na tabela payments
    await supabase.from("payments").upsert(
      {
        orderId,
        mpPaymentId:    paymentId,
        mpPreferenceId: (payment as unknown as Record<string, string>).preference_id ?? null,
        mpStatus:       status ?? null,
        status:         status === "approved" ? "PAID" : status === "rejected" ? "UNPAID" : "UNPAID",
        amount:         payment.transaction_amount ?? 0,
        paidAt:         status === "approved" ? new Date().toISOString() : null,
        updatedAt:      new Date().toISOString(),
      },
      { onConflict: "orderId" }
    )

    // Atualiza paymentStatus do pedido
    if (status === "approved") {
      const { data: order } = await supabase
        .from("orders")
        .select("id, nome, email, whatsapp, subcategory, musicalStyle, voiceType, emotion, honoreeName, paymentStatus, createdAt")
        .eq("id", orderId)
        .single()

      await supabase
        .from("orders")
        .update({
          paymentStatus: "PAID",
          // Reconcilia produto/prazo com o pagamento aprovado (corrige troca via tela velha)
          ...(paidRow?.productId ? { productId: paidRow.productId } : {}),
          ...(paidRow?.deliveryOptionId ? { deliveryOptionId: paidRow.deliveryOptionId } : {}),
          updatedAt: new Date().toISOString(),
        })
        .eq("id", orderId)

      // Notifica admin só se ainda não estava PAID (evita duplo aviso no caso de webhook + confirm)
      if (order && order.paymentStatus !== "PAID") {
        // Cliente: gera token + e-mail "aprove sua letra" (idempotente; cobre o PIX
        // confirmado fora da aba, em que o /confirm não roda).
        await ensurePaymentPrep(supabase, orderId)

        await sendNewOrderPaidNotification({
          orderId:      order.id,
          nome:         order.nome,
          email:        order.email,
          whatsapp:     order.whatsapp,
          subcategory:  order.subcategory,
          musicalStyle: order.musicalStyle,
          voiceType:    order.voiceType,
          emotion:      order.emotion,
          honoreeName:  order.honoreeName,
          createdAt:    order.createdAt,
        })

        await triggerN8nWebhook({
          event:        "payment.confirmed",
          orderId:      order.id,
          nome:         order.nome,
          email:        order.email,
          whatsapp:     order.whatsapp,
          whatsappE164: toE164(order.whatsapp),
          subcategory:  order.subcategory,
          musicalStyle: order.musicalStyle,
          voiceType:    order.voiceType,
          emotion:      order.emotion,
          createdAt:    order.createdAt,
        })
      }
    } else if (status === "rejected") {
      await supabase
        .from("orders")
        .update({ paymentStatus: "UNPAID", updatedAt: new Date().toISOString() })
        .eq("id", orderId)
    }

    console.log(`[webhook MP] payment ${paymentId} — ${status} — order ${orderId}`)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[webhook MP]", err)
    // Retorna 200 para MP não retentar infinitamente
    return NextResponse.json({ received: true })
  }
}
