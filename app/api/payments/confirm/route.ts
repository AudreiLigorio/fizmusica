import { NextResponse } from "next/server"
import crypto from "crypto"
import { createServerClient } from "@/lib/supabase"
import { sendNewOrderPaidNotification, sendPaymentConfirmedEmail } from "@/app/services/emailService"
import { triggerN8nWebhook } from "@/app/services/orderService"

// Confirma pagamento aprovado diretamente no Supabase
// O status já foi verificado pelo MP na rota /api/payments/create
export async function POST(req: Request) {
  try {
    const { orderId, mpPaymentId } = await req.json()

    if (!orderId) {
      return NextResponse.json({ success: false, error: "orderId obrigatório" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Atualiza pedido como PAID
    await supabase
      .from("orders")
      .update({ paymentStatus: "PAID", updatedAt: new Date().toISOString() })
      .eq("id", orderId)

    // Atualiza registro de pagamento
    await supabase
      .from("payments")
      .update({ status: "PAID", mpStatus: "approved", paidAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .eq("orderId", orderId)

    // Busca dados do pedido para notificação
    const { data: order } = await supabase
      .from("orders")
      .select("id, nome, email, whatsapp, subcategory, musicalStyle, voiceType, emotion, honoreeName, createdAt, photo_token")
      .eq("id", orderId)
      .single()

    if (order) {
      // ── Convite para anexar fotos (link tokenizado, sem login) ──
      // Gera o token na primeira confirmação; idempotente em reentregas do webhook.
      let photoToken: string | null = (order as any).photo_token ?? null
      if (!photoToken) {
        photoToken = crypto.randomUUID()
        const { error: tokErr } = await supabase
          .from("orders")
          .update({ photo_token: photoToken })
          .eq("id", orderId)
        if (tokErr) {
          console.error("[confirm] falha ao gerar photo_token:", tokErr.message)
          photoToken = null
        } else {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"
          const areaUrl = `${baseUrl}/minha-musica?orderId=${orderId}`
          const r = await sendPaymentConfirmedEmail({ nome: order.nome, email: order.email, areaUrl })
          if (!r.ok) console.error("[confirm] e-mail de pagamento confirmado falhou:", r.error)
        }
      }

      // Notifica admin por e-mail
      await sendNewOrderPaidNotification({
        orderId:      order.id,
        nome:         order.nome,
        email:        order.email,
        whatsapp:     order.whatsapp,
        subcategory:  order.subcategory,
        musicalStyle: order.musicalStyle,
        voiceType:    order.voiceType,
        emotion:      order.emotion,
        honoreeName:  order.honoreeName,
        createdAt:    order.createdAt,
      })

      // Dispara n8n (WhatsApp admin ou automação)
      await triggerN8nWebhook({
        event:        "payment.confirmed",
        orderId:      order.id,
        nome:         order.nome,
        email:        order.email,
        whatsapp:     order.whatsapp,
        context:      "",
        subcategory:  order.subcategory,
        musicalStyle: order.musicalStyle,
        voiceType:    order.voiceType,
        emotion:      order.emotion,
        answers:      [],
        createdAt:    order.createdAt,
      } as Parameters<typeof triggerN8nWebhook>[0])
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[confirm]", err)
    return NextResponse.json({ success: false, error: "Erro ao confirmar" }, { status: 500 })
  }
}
