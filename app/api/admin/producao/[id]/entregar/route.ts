import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { sendMusicDeliveryEmail } from "@/app/services/emailService"
import { triggerN8nWebhook } from "@/app/services/orderService"

type Params = Promise<{ id: string }>

function generateSlug(orderId: string): string {
  // Slug legível: 8 chars do orderId + 4 chars aleatórios
  const short = orderId.replace(/-/g, "").slice(0, 8)
  const rand  = Math.random().toString(36).slice(2, 6)
  return `${short}${rand}`
}

export async function POST(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const supabase = createServerClient()

  // Busca order + música
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(`id, nome, email, whatsapp, subcategory, musicalStyle, generated_music(*)`)
    .eq("id", id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  }

  const music = Array.isArray(order.generated_music)
    ? order.generated_music[0]
    : order.generated_music

  if (!music?.mp3_url) {
    return NextResponse.json({ error: "Música ainda não produzida (sem MP3)." }, { status: 400 })
  }

  // Gera slug se ainda não existe
  let slug = music.slug as string | null
  if (!slug) {
    slug = generateSlug(id)
    const { error: slugError } = await supabase
      .from("generated_music")
      .update({ slug })
      .eq("order_id", id)

    if (slugError) {
      return NextResponse.json({ error: slugError.message }, { status: 500 })
    }
  }

  const baseUrl   = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
  const publicUrl = `${baseUrl}/m/${slug}`

  // Envia e-mail ao cliente
  await sendMusicDeliveryEmail({
    nome:      order.nome,
    email:     order.email,
    musicName: music.music_name ?? "Sua música",
    publicUrl,
    orderId:   id,
  })

  // Dispara n8n (WhatsApp)
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
    musicName:    music.music_name ?? "",
  } as Parameters<typeof triggerN8nWebhook>[0])

  // Marca pedido como DELIVERED
  await supabase
    .from("orders")
    .update({ status: "DELIVERED", updatedAt: new Date().toISOString() })
    .eq("id", id)

  return NextResponse.json({ ok: true, publicUrl, slug })
}
