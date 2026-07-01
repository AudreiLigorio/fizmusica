import { NextRequest, NextResponse } from "next/server"
import MercadoPago, { Payment } from "mercadopago"
import { createServerClient } from "@/lib/supabase"
import { ensurePaymentPrep } from "@/lib/payments/prep"

export const dynamic = "force-dynamic"

const mp = new MercadoPago({ accessToken: process.env.MP_ACCESS_TOKEN! })

// Reconcilia um pedido SEM (ou com) pagamento registrado: procura no Mercado Pago
// por external_reference = orderId (a chave que o /create grava). Se achar um
// pagamento APROVADO, religa ao pedido (grava payments + marca PAID + dispara o
// funil). Resolve o caso "cliente jura que pagou mas o aviso do MP se perdeu".
export async function POST(req: NextRequest) {
  const { orderId } = await req.json().catch(() => ({}))
  if (!orderId) return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 })

  const supabase = createServerClient()
  const paymentClient = new Payment(mp)

  let results: any[] = []
  try {
    const r: any = await paymentClient.search({ options: { external_reference: orderId } as any })
    results = r?.results ?? []
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao consultar o Mercado Pago." }, { status: 502 })
  }

  if (results.length === 0) {
    return NextResponse.json({ ok: true, found: 0, updated: false, message: "Nenhum pagamento encontrado no Mercado Pago para este pedido." })
  }

  // Procura um aprovado; senão, reporta o status mais relevante encontrado.
  const approved = results.find((p) => p.status === "approved")
  if (!approved) {
    const statuses = [...new Set(results.map((p) => p.status))].join(", ")
    return NextResponse.json({ ok: true, found: results.length, updated: false, message: `Encontrado no MP, mas não aprovado (status: ${statuses}).` })
  }

  // Religa o pagamento ao pedido
  await supabase.from("payments").upsert({
    orderId,
    mpPaymentId:    String(approved.id),
    mpStatus:       "approved",
    status:         "PAID",
    amount:         approved.transaction_amount ?? 0,
    paidAt:         approved.date_approved ?? new Date().toISOString(),
    updatedAt:      new Date().toISOString(),
  }, { onConflict: "orderId" })

  const { data: order } = await supabase
    .from("orders").select("paymentStatus").eq("id", orderId).maybeSingle()

  await supabase.from("orders").update({ paymentStatus: "PAID", updatedAt: new Date().toISOString() }).eq("id", orderId)

  // Dispara o funil (token + e-mail "aprove sua letra") só na primeira vez.
  if (order?.paymentStatus !== "PAID") {
    await ensurePaymentPrep(supabase, orderId)
  }

  return NextResponse.json({
    ok: true,
    found: results.length,
    updated: true,
    mpPaymentId: String(approved.id),
    amount: approved.transaction_amount ?? 0,
    message: "Pagamento encontrado no Mercado Pago e religado ao pedido!",
  })
}
