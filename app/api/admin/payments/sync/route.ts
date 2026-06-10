import { NextRequest, NextResponse } from "next/server"
import MercadoPago, { Payment } from "mercadopago"
import { createServerClient } from "@/lib/supabase"
import { sendNewOrderPaidNotification } from "@/app/services/emailService"
import { triggerN8nWebhook } from "@/app/services/orderService"

export const dynamic = "force-dynamic"

const mp = new MercadoPago({ accessToken: process.env.MP_ACCESS_TOKEN! })

export async function POST(req: NextRequest) {
  const { orderId } = await req.json()
  if (!orderId) return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 })

  const supabase = createServerClient()

  // Busca o mpPaymentId salvo
  const { data: payment } = await supabase
    .from("payments")
    .select("mpPaymentId, status")
    .eq("orderId", orderId)
    .maybeSingle()

  if (!payment?.mpPaymentId) {
    return NextResponse.json({ error: "Nenhum pagamento encontrado para este pedido." }, { status: 404 })
  }

  // Consulta status real no MP
  const paymentClient = new Payment(mp)
  const result = await paymentClient.get({ id: payment.mpPaymentId })
  const mpStatus = result.status // approved | pending | rejected

  console.log(`[sync] order ${orderId} — MP status: ${mpStatus}`)

  if (mpStatus === "approved") {
    const { data: order } = await supabase
      .from("orders")
      .select("id, nome, email, whatsapp, subcategory, musicalStyle, voiceType, emotion, honoreeName, paymentStatus, createdAt")
      .eq("id", orderId)
      .single()

    // Atualiza no banco
    await supabase.from("orders").update({ paymentStatus: "PAID", updatedAt: new Date().toISOString() }).eq("id", orderId)
    await supabase.from("payments").update({
      status: "PAID", mpStatus: "approved",
      paidAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).eq("orderId", orderId)

    // Notifica admin (só se ainda não estava PAID)
    if (order && order.paymentStatus !== "PAID") {
      await sendNewOrderPaidNotification({
        orderId: order.id, nome: order.nome, email: order.email,
        whatsapp: order.whatsapp, subcategory: order.subcategory,
        musicalStyle: order.musicalStyle, voiceType: order.voiceType,
        emotion: order.emotion, honoreeName: order.honoreeName,
        createdAt: order.createdAt,
      })
      await triggerN8nWebhook({
        event: "payment.confirmed", orderId: order.id, nome: order.nome,
        email: order.email, whatsapp: order.whatsapp, context: "",
        subcategory: order.subcategory, musicalStyle: order.musicalStyle,
        voiceType: order.voiceType, emotion: order.emotion,
        answers: [], createdAt: order.createdAt,
      } as any)
    }

    return NextResponse.json({ ok: true, mpStatus, updated: true, message: "Pagamento confirmado e pedido atualizado!" })
  }

  return NextResponse.json({ ok: true, mpStatus, updated: false, message: `Status no MP: ${mpStatus}` })
}
