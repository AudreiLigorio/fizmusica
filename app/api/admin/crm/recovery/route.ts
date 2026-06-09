import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { sendRecoveryEmail } from "@/app/services/emailService"

// POST — envia e-mail de recuperação para um pedido não pago
export async function POST(req: NextRequest) {
  const { orderId } = await req.json()
  if (!orderId) return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 })

  const supabase = createServerClient()
  const { data: order } = await supabase
    .from("orders")
    .select("id, nome, email, subcategory, musicalStyle")
    .eq("id", orderId)
    .single()

  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })

  const result = await sendRecoveryEmail({
    orderId:      order.id,
    nome:         order.nome,
    email:        order.email,
    subcategory:  order.subcategory,
    musicalStyle: order.musicalStyle,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
