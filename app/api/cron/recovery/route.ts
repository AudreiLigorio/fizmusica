import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { sendRecoveryEmail } from "@/app/services/emailService"

export const dynamic = "force-dynamic"
export const maxDuration = 60 // segundos — suficiente para enviar vários e-mails

export async function GET(req: NextRequest) {
  // Verifica autorização (Vercel envia o CRON_SECRET no header)
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const supabase = createServerClient()

  // Janela de repescagem: pedidos entre 2h e 7 dias atrás
  const twoHoursAgo  = new Date(Date.now() - 2  * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, nome, email, subcategory, musicalStyle")
    .eq("paymentStatus", "UNPAID")
    .neq("status", "ABANDONED")   // ainda não processado
    .lt("createdAt", twoHoursAgo) // mais de 2h sem pagar
    .gt("createdAt", sevenDaysAgo) // até 7 dias atrás (depois não faz sentido)
    .order("createdAt", { ascending: true })
    .limit(50) // segurança: máx 50 por execução

  if (error) {
    console.error("[cron/recovery] Erro ao buscar pedidos:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!orders?.length) {
    console.log("[cron/recovery] Nenhum pedido para recuperar")
    return NextResponse.json({ processed: 0 })
  }

  console.log(`[cron/recovery] Processando ${orders.length} pedido(s)...`)

  let sent = 0, failed = 0
  const failedIds: string[] = []

  for (const order of orders) {
    // Envia e-mail de recuperação
    const result = await sendRecoveryEmail({
      orderId:      order.id,
      nome:         order.nome,
      email:        order.email,
      subcategory:  order.subcategory,
      musicalStyle: order.musicalStyle,
    })

    // Marca como ABANDONADO independente do resultado do e-mail
    // (evita reenvio em execuções futuras)
    await supabase
      .from("orders")
      .update({
        status:    "ABANDONED",
        updatedAt: new Date().toISOString(),
      })
      .eq("id", order.id)

    if (result.ok) {
      sent++
      console.log(`[cron/recovery] ✅ ${order.email} — ${order.nome}`)
    } else {
      failed++
      failedIds.push(order.id)
      console.warn(`[cron/recovery] ⚠️ Falha e-mail ${order.email}: ${result.error}`)
    }
  }

  return NextResponse.json({
    processed: orders.length,
    sent,
    failed,
    failedIds,
  })
}
