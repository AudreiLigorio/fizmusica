import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

// Confirma pagamento aprovado diretamente no Supabase
// O status já foi verificado pelo MP na rota /api/payments/create
export async function POST(req: Request) {
  try {
    const { orderId, mpPaymentId } = await req.json()

    if (!orderId) {
      return NextResponse.json({ success: false, error: "orderId obrigatório" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Atualiza pedido como PAID
    await supabase
      .from("orders")
      .update({ paymentStatus: "PAID", updatedAt: new Date().toISOString() })
      .eq("id", orderId)

    // Atualiza registro de pagamento
    await supabase
      .from("payments")
      .update({ status: "PAID", mpStatus: "approved", paidAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .eq("orderId", orderId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[confirm]", err)
    return NextResponse.json({ success: false, error: "Erro ao confirmar" }, { status: 500 })
  }
}
