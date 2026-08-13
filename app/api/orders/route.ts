import { NextRequest, NextResponse, after } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createOrder, triggerN8nWebhook } from "@/app/services/orderService"
import { sendOrderConfirmationEmail, sendOrderNotificationEmail } from "@/app/services/emailService"
import { createOrderSchema } from "@/lib/validators/order"
import { createServerClient } from "@/lib/supabase"
import { extractClientIp, lookupState } from "@/lib/geoip"
import { toE164 } from "@/lib/n8n/events"

export async function GET(req: NextRequest) {
  // Identidade: prioriza o token de login (Bearer) — busca por e-mail OU userId
  // (pedidos reivindicados). Sem token, mantém o modo legado por ?email=.
  const auth = req.headers.get("authorization") ?? ""
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null
  let userId: string | null = null
  let email = req.nextUrl.searchParams.get("email")

  if (bearer) {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data } = await anon.auth.getUser(bearer)
    if (data.user) { userId = data.user.id; email = data.user.email ?? email }
  }

  if (!email && !userId) return NextResponse.json({ orders: [] })

  const supabase = createServerClient()
  const filter = [email ? `email.eq.${email}` : null, userId ? `userId.eq.${userId}` : null].filter(Boolean).join(",")

  const { data, error } = await supabase
    .from("orders")
    .select(`id, nome, email, whatsapp, context, subcategory, musicalStyle, voiceType, emotion, honoreeName, status, paymentStatus, createdAt, photo_token, is_revision, sharing_term_accepted_at, lyricsApproved, productId, sunoStatus, sunoTracks, publication_consent, shipping_name, shipping_cep, shipping_address, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, shipping_phone, products(name, price), payments(amount, mpStatus, paidAt), order_photos(id), order_answers(question, answer, position)`)
    .or(filter)
    .order("createdAt", { ascending: false })

  if (error) return NextResponse.json({ orders: [] })

  // Anexa slug + mp3 da música (quando publicada) para os botões Ouvir/Baixar
  const ids = (data ?? []).map((o) => o.id)
  const musicByOrder: Record<string, { slug: string | null; mp3Url: string | null }> = {}
  if (ids.length) {
    const { data: gm } = await supabase
      .from("generated_music")
      .select("orderId, slug, mp3Url")
      .in("orderId", ids)
    for (const g of gm ?? []) musicByOrder[g.orderId as string] = { slug: g.slug ?? null, mp3Url: g.mp3Url ?? null }
  }

  const orders = (data ?? []).map((o) => {
    // Renomeia sunoStatus/sunoTracks para nomes neutros na resposta — a chave literal
    // do JSON é o único lugar onde "suno" chegaria ao cliente (via DevTools/Network).
    const { order_photos, order_answers, sunoStatus, sunoTracks, payments, ...rest } = o as typeof o & {
      order_photos?: { id: string }[]
      order_answers?: { question: string; answer: string; position: number }[]
      sunoStatus?: string | null
      sunoTracks?: unknown
      payments?: unknown
    }
    const answers = Array.isArray(order_answers)
      ? [...order_answers].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      : []
    // Supabase embute payments como ARRAY mesmo com orderId único — normaliza pra
    // objeto único (já inclui entrega+cupom, calculado em /api/payments/create).
    const paymentRow = Array.isArray(payments) ? (payments[0] ?? null) : (payments ?? null)
    return {
      ...rest,
      musicStatus: sunoStatus ?? null,
      tracks:      sunoTracks ?? null,
      slug:       musicByOrder[o.id]?.slug ?? null,
      mp3Url:     musicByOrder[o.id]?.mp3Url ?? null,
      photoCount: Array.isArray(order_photos) ? order_photos.length : 0,
      answers,
      payments: paymentRow,
    }
  })
  return NextResponse.json({ orders })
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json()
    const parsed = createOrderSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const body = parsed.data
    const customerIp = extractClientIp(req.headers)

    // Salva no banco
    const order = await createOrder(body, customerIp)

    // Dispara e-mails e n8n APÓS a resposta (after garante execução mesmo após response)
    const emailData = {
      orderId: order.id,
      nome: order.nome,
      email: order.email,
      whatsapp: order.whatsapp,
      context: order.context,
      subcategory: order.subcategory,
      musicalStyle: order.musicalStyle,
      voiceType: order.voiceType,
      emotion: order.emotion,
      createdAt: order.createdAt,
    }
    after(async () => {
      if (customerIp) {
        const geo = await lookupState(customerIp)
        if (geo.state) {
          await createServerClient().from("orders").update({ customer_state: geo.state }).eq("id", order.id)
        }
      }
      await sendOrderConfirmationEmail(emailData)
      await sendOrderNotificationEmail(emailData)
      await triggerN8nWebhook({
        event: "order.created",
        orderId: order.id,
        nome: order.nome,
        whatsapp: order.whatsapp,
        whatsappE164: toE164(order.whatsapp),
        email: order.email,
        context: order.context,
        subcategory: order.subcategory,
        musicalStyle: order.musicalStyle,
        voiceType: order.voiceType,
        emotion: order.emotion,
        answers: body.answers,
        createdAt: order.createdAt.toISOString(),
      })
    })

    return NextResponse.json(
      { success: true, orderId: order.id },
      { status: 201 }
    )
  } catch (error) {
    console.error("[POST /api/orders]", JSON.stringify(error))
    return NextResponse.json(
      { success: false, error: "Erro interno. Tente novamente." },
      { status: 500 }
    )
  }
}
