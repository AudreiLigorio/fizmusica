import { NextRequest, NextResponse, after } from "next/server"
import { createOrder, triggerN8nWebhook } from "@/app/services/orderService"
import { sendOrderConfirmationEmail, sendOrderNotificationEmail } from "@/app/services/emailService"
import { createOrderSchema } from "@/lib/validators/order"
import { createServerClient } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")
  if (!email) return NextResponse.json({ orders: [] })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("orders")
    .select(`id, context, subcategory, status, paymentStatus, createdAt, photo_token, products(name, price), payments(amount, mpStatus)`)
    .eq("email", email)
    .order("createdAt", { ascending: false })

  if (error) return NextResponse.json({ orders: [] })

  // Anexa o slug da música (quando publicada) para o botão "Ouvir"
  const ids = (data ?? []).map((o) => o.id)
  const slugByOrder: Record<string, string> = {}
  if (ids.length) {
    const { data: gm } = await supabase
      .from("generated_music")
      .select("orderId, slug")
      .in("orderId", ids)
    for (const g of gm ?? []) if (g.slug) slugByOrder[g.orderId as string] = g.slug as string
  }

  const orders = (data ?? []).map((o) => ({ ...o, slug: slugByOrder[o.id] ?? null }))
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

    // Salva no banco
    const order = await createOrder(body)

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
      await sendOrderConfirmationEmail(emailData)
      await sendOrderNotificationEmail(emailData)
      await triggerN8nWebhook({
        event: "order.created",
        orderId: order.id,
        nome: order.nome,
        whatsapp: order.whatsapp,
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
