import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { sendNewOrderPaidNotification } from "@/app/services/emailService"
import { triggerN8nWebhook } from "@/app/services/orderService"
import { ensurePaymentPrep } from "@/lib/payments/prep"

// Confirma pagamento aprovado diretamente no Supabase
// O status já foi verificado pelo MP na rota /api/payments/create
export async function POST(req: Request) {
  try {
    const { orderId, mpPaymentId } = await req.json()

    if (!orderId) {
      return NextResponse.json({ success: false, error: "orderId obrigatório" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Reconcilia produto/prazo com o pagamento (Fix 3)
    const { data: paidRow } = await supabase
      .from("payments")
      .select("productId, deliveryOptionId")
      .eq("orderId", orderId)
      .maybeSingle()

    // Atualiza pedido como PAID
    await supabase
      .from("orders")
      .update({
        paymentStatus: "PAID",
        ...(paidRow?.productId ? { productId: paidRow.productId } : {}),
        ...(paidRow?.deliveryOptionId ? { deliveryOptionId: paidRow.deliveryOptionId } : {}),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", orderId)

    // Atualiza registro de pagamento
    await supabase
      .from("payments")
      .update({ status: "PAID", mpStatus: "approved", paidAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .eq("orderId", orderId)

    // Busca dados do pedido para notificação
    const { data: order } = await supabase
      .from("orders")
      .select("id, nome, email, whatsapp, subcategory, musicalStyle, voiceType, emotion, honoreeName, createdAt, photo_token")
      .eq("id", orderId)
      .single()

    if (order) {
      // Gera o photo_token + envia o e-mail "aprove sua letra" (idempotente; o mesmo
      // helper roda no webhook, então quem paga PIX e fecha a aba também recebe).
      await ensurePaymentPrep(supabase, orderId)

      // Notifica admin por e-mail
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

      // Dispara n8n (WhatsApp admin ou automação)
      await triggerN8nWebhook({
        event:        "payment.confirmed",
        orderId:      order.id,
        nome:         order.nome,
        email:        order.email,
        whatsapp:     order.whatsapp,
        context:      "",
        subcategory:  order.subcategory,
        musicalStyle: order.musicalStyle,
        voiceType:    order.voiceType,
        emotion:      order.emotion,
        answers:      [],
        createdAt:    order.createdAt,
      } as Parameters<typeof triggerN8nWebhook>[0])
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[confirm]", err)
    return NextResponse.json({ success: false, error: "Erro ao confirmar" }, { status: 500 })
  }
}
