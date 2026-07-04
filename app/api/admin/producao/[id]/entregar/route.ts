import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { sendMusicDeliveryEmail } from "@/app/services/emailService"
import { triggerN8nWebhook } from "@/app/services/orderService"
import { getActivePublicCoupon, couponLabel } from "@/lib/coupons"
import crypto from "crypto"

type Params = Promise<{ id: string }>

function generateSlug(orderId: string): string {
  const short = orderId.replace(/-/g, "").slice(0, 8)
  const rand  = Math.random().toString(36).slice(2, 6)
  return `${short}${rand}`
}

export async function POST(_req: NextRequest, { params }: { params: Params }) {
  try {
  const { id } = await params
  const supabase = createServerClient()

  // Busca order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, nome, email, whatsapp, subcategory, musicalStyle")
    .eq("id", id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  }

  // Busca música
  const { data: music } = await supabase
    .from("generated_music")
    .select("*")
    .eq("orderId", id)
    .maybeSingle()

  if (!music?.mp3Url) {
    return NextResponse.json({ error: "Música ainda não produzida (sem MP3)." }, { status: 400 })
  }

  // Gera slug se ainda não existe + marca data de publicação (base do prazo de retenção)
  let slug = music.slug as string | null
  if (!slug) {
    slug = generateSlug(id)
    const { error: slugError } = await supabase
      .from("generated_music")
      .update({ slug, publishedAt: new Date().toISOString() })
      .eq("orderId", id)

    if (slugError) {
      return NextResponse.json({ error: slugError.message }, { status: 500 })
    }
  } else if (!music.publishedAt) {
    await supabase
      .from("generated_music")
      .update({ publishedAt: new Date().toISOString() })
      .eq("orderId", id)
  }

  const baseUrl    = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
  const publicUrl  = `${baseUrl}/m/${slug}`
  const areaUrl    = `${baseUrl}/minha-musica?orderId=${id}`

  // ── 1. Cria token de feedback (UUID aleatório) ──
  const feedbackToken = crypto.randomUUID()

  // Verifica se já existe feedback para este pedido
  const { data: existingFeedback } = await supabase
    .from("feedbacks")
    .select("id, token")
    .eq("orderId", id)
    .maybeSingle()

  let activeFeedbackToken = existingFeedback?.token ?? feedbackToken

  if (!existingFeedback) {
    await supabase.from("feedbacks").insert({
      orderId: id,
      token:   feedbackToken,
    })
  }

  const feedbackUrl = `${baseUrl}/feedback/${activeFeedbackToken}`

  // ── 2. E-mail de entrega → leva à área do cliente (acesso após aceite do termo) ──
  const promo = await getActivePublicCoupon(supabase)
  const emailResult = await sendMusicDeliveryEmail({
    nome:      order.nome,
    email:     order.email,
    musicName: music.musicName?.trim() || "Sua música",
    areaUrl,
    orderId:   id,
    loyaltyCoupon: promo ? { code: promo.code, label: couponLabel(promo) } : null,
  })
  if (!emailResult.ok) {
    console.error("[entregar] e-mail de entrega falhou:", emailResult.error)
  }

  // ── 3. Agenda e-mail de feedback para o dia seguinte (cron diário 13h UTC) ──
  if (!existingFeedback) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    tomorrow.setUTCHours(15, 0, 0, 0)
    await supabase
      .from("feedbacks")
      .update({ send_after: tomorrow.toISOString() })
      .eq("orderId", id)
  }

  // ── 4. n8n: music.delivered (WhatsApp com link da música) ──
  await triggerN8nWebhook({
    event:        "music.delivered",
    orderId:      id,
    nome:         order.nome,
    email:        order.email,
    whatsapp:     order.whatsapp,
    context:      "",
    subcategory:  order.subcategory,
    musicalStyle: order.musicalStyle,
    voiceType:    "",
    emotion:      "",
    answers:      [],
    createdAt:    new Date().toISOString(),
    publicUrl,
    musicName:    music.musicName ?? "",
  } as Parameters<typeof triggerN8nWebhook>[0])

  // ── 5. n8n: feedback.request (WhatsApp com link de avaliação) ──
  await triggerN8nWebhook({
    event:        "feedback.request" as any,
    orderId:      id,
    nome:         order.nome,
    email:        order.email,
    whatsapp:     order.whatsapp,
    context:      feedbackUrl,   // feedbackUrl no campo context (disponível no n8n)
    subcategory:  order.subcategory,
    musicalStyle: order.musicalStyle,
    voiceType:    "",
    emotion:      "",
    answers:      [],
    createdAt:    new Date().toISOString(),
    publicUrl:    feedbackUrl,
    musicName:    music.musicName ?? "",
  } as Parameters<typeof triggerN8nWebhook>[0])

  // ── 6. Marca pedido como DELIVERED ──
  await supabase
    .from("orders")
    .update({ status: "DELIVERED", updatedAt: new Date().toISOString() })
    .eq("id", id)

  return NextResponse.json({
    ok: true,
    publicUrl,
    slug,
    feedbackUrl,
    emailSent:         emailResult.ok,
    emailError:        emailResult.ok         ? undefined : emailResult.error,
    feedbackEmailScheduled: true,
  })
  } catch (err: any) {
    console.error("[entregar] erro inesperado:", err)
    return NextResponse.json({ error: err?.message ?? "Erro interno" }, { status: 500 })
  }
}
