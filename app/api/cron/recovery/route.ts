import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { sendRecoveryEmail } from "@/app/services/emailService"
import { getActivePublicCoupon, couponLabel } from "@/lib/coupons"
import { runPurge } from "@/lib/purge"

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

  // Janela de repescagem: pedidos entre 4h e 7 dias atrás (envia 1 vez apenas)
  const fourHoursAgo = new Date(Date.now() - 4  * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, nome, email, subcategory, musicalStyle")
    .eq("paymentStatus", "UNPAID")
    .neq("status", "ABANDONED")    // ainda não enviado (marca ABANDONED após envio)
    .lt("createdAt", fourHoursAgo) // mais de 4h sem pagar
    .gt("createdAt", sevenDaysAgo) // até 7 dias atrás
    .order("createdAt", { ascending: true })
    .limit(50) // segurança: máx 50 por execução

  // A repescagem pode não ter o que fazer (ou falhar), mas o EXPURGO abaixo
  // roda de qualquer jeito: sair daqui com `return` fazia dia sem e-mail de
  // recuperação virar dia sem expurgo LGPD — foi o que aconteceu de verdade
  // entre junho e agosto/2026, com o `purge_log` cheio de buracos e sessões
  // vencidas sobrevivendo semanas além do prazo. Apagar dado pessoal no prazo
  // é obrigação nossa; não pode depender de haver carrinho abandonado no dia.
  if (error) {
    console.error("[cron/recovery] Erro ao buscar pedidos:", error)
  } else if (!orders?.length) {
    console.log("[cron/recovery] Nenhum pedido para recuperar")
  }

  let sent = 0, failed = 0
  const failedIds: string[] = []

  if (orders?.length) {
    console.log(`[cron/recovery] Processando ${orders.length} pedido(s)...`)

    // Cupom ativo para incluir na repescagem (se houver)
    const promo = await getActivePublicCoupon(supabase)
    const couponForEmail = promo ? { code: promo.code, label: couponLabel(promo) } : null

    for (const order of orders) {
      // Envia e-mail de recuperação
      const result = await sendRecoveryEmail({
        orderId:      order.id,
        nome:         order.nome,
        email:        order.email,
        subcategory:  order.subcategory,
        musicalStyle: order.musicalStyle,
        coupon:       couponForEmail,
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
  }

  // ── EXPURGO (LGPD) ──────────────────────────────────────────────
  const purge = await runPurge(supabase)

  // Registra a execução (relatório + status de saúde da tela Operação)
  await supabase.from("purge_log").insert({
    photos_purged:      purge.photosPurged,
    leads_purged:       purge.leadsPurged,
    music_purged:       purge.musicPurged ?? 0,
    paid_photos_purged: purge.paidPhotosPurged ?? 0,
    sessions_purged:    purge.sessionsPurged ?? 0,
    recovery_sent:      sent,
    errors:             purge.errors.length ? purge.errors.join(" | ") : null,
  })

  // Falha na busca de pedidos ainda devolve 500 — é assim que o painel da Vercel
  // marca a execução como vermelha e a gente descobre. Só que agora o 500 sai
  // DEPOIS do expurgo, não no lugar dele.
  return NextResponse.json(
    {
      processed: orders?.length ?? 0,
      recoveryError: error?.message ?? null,
      sent,
      failed,
      failedIds,
      purge,
    },
    { status: error ? 500 : 200 }
  )
}


