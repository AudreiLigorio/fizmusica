// APENAS DESENVOLVIMENTO — simula retorno "approved" do Mercado Pago
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  const { orderId } = await req.json()
  if (!orderId) {
    return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 })
  }

  const supabase = createServerClient()

  const fakePaymentId = `test_${Date.now()}`

  await supabase.from("payments").upsert(
    {
      orderId,
      mpPaymentId: fakePaymentId,
      mpStatus: "approved",
      status: "PAID",
      amount: 0,
      paidAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { onConflict: "orderId" },
  )

  await supabase
    .from("orders")
    .update({ paymentStatus: "PAID", updatedAt: new Date().toISOString() })
    .eq("id", orderId)

  return NextResponse.json({ ok: true, orderId, fakePaymentId })
}
