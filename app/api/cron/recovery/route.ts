import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { sendRecoveryEmail } from "@/app/services/emailService"
import { getActivePublicCoupon, couponLabel } from "@/lib/coupons"

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

  if (error) {
    console.error("[cron/recovery] Erro ao buscar pedidos:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!orders?.length) {
    console.log("[cron/recovery] Nenhum pedido para recuperar")
    return NextResponse.json({ processed: 0 })
  }

  console.log(`[cron/recovery] Processando ${orders.length} pedido(s)...`)

  // Cupom ativo para incluir na repescagem (se houver)
  const promo = await getActivePublicCoupon(supabase)
  const couponForEmail = promo ? { code: promo.code, label: couponLabel(promo) } : null

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

  // ── EXPURGO (LGPD) ──────────────────────────────────────────────
  const purge = await runPurge(supabase)

  // Registra a execução (relatório + status de saúde da tela Operação)
  await supabase.from("purge_log").insert({
    photos_purged:      purge.photosPurged,
    leads_purged:       purge.leadsPurged,
    music_purged:       purge.musicPurged ?? 0,
    paid_photos_purged: purge.paidPhotosPurged ?? 0,
    recovery_sent:      sent,
    errors:             purge.errors.length ? purge.errors.join(" | ") : null,
  })

  return NextResponse.json({
    processed: orders.length,
    sent,
    failed,
    failedIds,
    purge,
  })
}

const BUCKET = "order-photos"

// Expurga fotos (fotos de terceiros sem compra) e, depois, o cadastro do lead.
// Nunca toca em pedidos PAGOS nem em pedidos de revisão.
async function runPurge(supabase: ReturnType<typeof createServerClient>) {
  const errors: string[] = []
  let photosPurged = 0
  let leadsPurged  = 0
  let paidPhotosPurged = 0

  let musicPurged = 0 // conta LINKS DESATIVADOS (não apaga mais o MP3 — ver migration 023)

  // Configuração editável na tela Operação
  const { data: settings } = await supabase
    .from("purge_settings")
    .select("photos_days, lead_days, enabled, music_enabled, music_days")
    .eq("id", 1)
    .maybeSingle()

  if (!settings) {
    return { photosPurged, leadsPurged, musicPurged, paidPhotosPurged, errors, skipped: true }
  }

  // Desativação do LINK PÚBLICO após o prazo (opcional, desligado por padrão).
  // O MP3/letra NUNCA são apagados — a Fiz Música retém a obra por direito
  // (Licença de Uso, cláusulas 6+9). Só o acesso público (/m/slug) para de
  // funcionar. No MESMO evento, as FOTOS do pedido são removidas (dado mais
  // sensível — imagem de pessoa real; nunca reutilizadas, conforme os Termos).
  if (settings.music_enabled) {
    try {
      const musicCutoff = new Date(Date.now() - settings.music_days * 24 * 60 * 60 * 1000).toISOString()
      const { data: oldMusic } = await supabase
        .from("generated_music")
        .select("id, orderId")
        .not("slug", "is", null)
        .is("link_disabled_at", null)
        .lt("publishedAt", musicCutoff)
        .limit(100)

      for (const m of oldMusic ?? []) {
        const { error: updErr } = await supabase
          .from("generated_music")
          .update({ link_disabled_at: new Date().toISOString() })
          .eq("id", m.id)
        if (updErr) { errors.push(`generated_music update: ${updErr.message}`); continue }
        musicPurged++

        // Fotos do pedido: removidas junto (arquivo + registro), capa da IA inclusa.
        const { data: photos } = await supabase
          .from("order_photos")
          .select("id, storage_path")
          .eq("orderId", m.orderId)
        if (photos && photos.length > 0) {
          const paths = photos.map((p) => p.storage_path).filter(Boolean)
          if (paths.length > 0) {
            const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths)
            if (rmErr) errors.push(`order-photos remove: ${rmErr.message}`)
          }
          const { error: delErr } = await supabase.from("order_photos").delete().eq("orderId", m.orderId)
          if (delErr) errors.push(`order_photos delete: ${delErr.message}`)
          else paidPhotosPurged += photos.length
        }
      }
    } catch (e: any) {
      errors.push(`link/fotos: ${e?.message ?? e}`)
    }
  }

  if (!settings.enabled) {
    return { photosPurged, leadsPurged, musicPurged, paidPhotosPurged, errors, skipped: true }
  }

  const photosCutoff = new Date(Date.now() - settings.photos_days * 24 * 60 * 60 * 1000).toISOString()
  const leadCutoff   = new Date(Date.now() - settings.lead_days  * 24 * 60 * 60 * 1000).toISOString()

  try {
    // 1) Expurgo de FOTOS: pedidos UNPAID, não-revisão, mais velhos que photos_days
    const { data: oldUnpaid } = await supabase
      .from("orders")
      .select("id")
      .eq("paymentStatus", "UNPAID")
      .neq("is_revision", true)
      .lt("createdAt", photosCutoff)
      .limit(200)

    const ids = (oldUnpaid ?? []).map((o) => o.id)
    if (ids.length > 0) {
      const { data: photos } = await supabase
        .from("order_photos")
        .select("id, storage_path")
        .in("orderId", ids)

      if (photos && photos.length > 0) {
        const paths = photos.map((p) => p.storage_path).filter(Boolean)
        if (paths.length > 0) {
          const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths)
          if (rmErr) errors.push(`storage remove: ${rmErr.message}`)
        }
        const { error: delErr } = await supabase
          .from("order_photos")
          .delete()
          .in("id", photos.map((p) => p.id))
        if (delErr) errors.push(`order_photos delete: ${delErr.message}`)
        else photosPurged = photos.length
      }
    }
  } catch (e: any) {
    errors.push(`fotos: ${e?.message ?? e}`)
  }

  try {
    // 2) Expurgo do CADASTRO: pedidos UNPAID, não-revisão, mais velhos que lead_days
    const { data: deadLeads } = await supabase
      .from("orders")
      .select("id")
      .eq("paymentStatus", "UNPAID")
      .neq("is_revision", true)
      .lt("createdAt", leadCutoff)
      .limit(200)

    const ids = (deadLeads ?? []).map((o) => o.id)
    if (ids.length > 0) {
      // remove dependências antes do pedido
      await supabase.from("order_answers").delete().in("orderId", ids)
      await supabase.from("generated_music").delete().in("orderId", ids)
      await supabase.from("revision_requests").delete().in("orderId", ids)
      // fotos remanescentes (caso lead_days < photos_days, improvável)
      const { data: leftover } = await supabase.from("order_photos").select("id, storage_path").in("orderId", ids)
      if (leftover && leftover.length > 0) {
        const paths = leftover.map((p) => p.storage_path).filter(Boolean)
        if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths)
        await supabase.from("order_photos").delete().in("id", leftover.map((p) => p.id))
      }
      const { error: delErr } = await supabase.from("orders").delete().in("id", ids)
      if (delErr) errors.push(`orders delete: ${delErr.message}`)
      else leadsPurged = ids.length
    }
  } catch (e: any) {
    errors.push(`lead: ${e?.message ?? e}`)
  }

  return { photosPurged, leadsPurged, musicPurged, paidPhotosPurged, errors }
}
