import { NextResponse } from "next/server"
import MercadoPago, { Payment } from "mercadopago"
import { createServerClient } from "@/lib/supabase"

const client = new MercadoPago({ accessToken: process.env.MP_ACCESS_TOKEN! })

export async function POST(req: Request) {
  try {
    const { orderId, mpPaymentId } = await req.json()

    if (!orderId) {
      return NextResponse.json({ success: false, error: "orderId obrigatório" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Se tiver mpPaymentId, busca status direto no MP para confirmar
    if (mpPaymentId) {
      const paymentClient = new Payment(client)
      const payment = await paymentClient.get({ id: mpPaymentId })

      if (payment.status === "approved") {
        await supabase.from("orders")
          .update({ paymentStatus: "PAID", updatedAt: new Date().toISOString() })
          .eq("id", orderId)

        await supabase.from("payments").upsert({
          orderId,
          mpPaymentId: String(mpPaymentId),
          mpStatus: "approved",
          status: "PAID",
          amount: payment.transaction_amount ?? 0,
          paidAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { onConflict: "orderId" })

        return NextResponse.json({ success: true, status: "approved" })
      }
    }

    // Sem mpPaymentId — busca pagamento pelo orderId no banco
    const { data: paymentRow } = await supabase
      .from("payments")
      .select("mpPaymentId, status")
      .eq("orderId", orderId)
      .single()

    if (paymentRow?.status === "PAID") {
      return NextResponse.json({ success: true, status: "approved" })
    }

    return NextResponse.json({ success: true, status: "pending" })
  } catch (err) {
    console.error("[confirm]", err)
    return NextResponse.json({ success: false, error: "Erro ao confirmar" }, { status: 500 })
  }
}
