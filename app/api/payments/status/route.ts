import { NextResponse } from "next/server"
import MercadoPago, { Payment } from "mercadopago"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const client = new MercadoPago({ accessToken: process.env.MP_ACCESS_TOKEN! })

// Consulta o status do pagamento do pedido — usado pelo polling do PIX.
// Olha tanto o banco (atualizado pelo webhook) quanto o próprio MP (caso o
// webhook atrase), de forma que a tela avance assim que o pagamento cair.
export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get("orderId")
  if (!orderId) return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 })

  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders").select("paymentStatus").eq("id", orderId).maybeSingle()

  const { data: pay } = await supabase
    .from("payments").select("mpPaymentId").eq("orderId", orderId).maybeSingle()

  let mpStatus: string | null = null
  if (pay?.mpPaymentId) {
    try {
      const p = await new Payment(client).get({ id: pay.mpPaymentId })
      mpStatus = p.status ?? null
    } catch {
      // ignora — cai no status do banco
    }
  }

  const paid = order?.paymentStatus === "PAID" || mpStatus === "approved"

  const res = NextResponse.json({ paid, mpStatus, mpPaymentId: pay?.mpPaymentId ?? null })
  res.headers.set("Cache-Control", "no-store")
  return res
}
