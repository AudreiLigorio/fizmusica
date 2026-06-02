import { NextResponse } from "next/server"
import MercadoPago, { Payment } from "mercadopago"
import { createServerClient } from "@/lib/supabase"

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
      await supabase
        .from("orders")
        .update({ paymentStatus: "PAID", updatedAt: new Date().toISOString() })
        .eq("id", orderId)
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
