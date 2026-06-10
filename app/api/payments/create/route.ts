import { NextResponse } from "next/server"
import MercadoPago, { Payment } from "mercadopago"
import { createServerClient } from "@/lib/supabase"

const client = new MercadoPago({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { orderId, productId, productName, price, deliveryOptionId, paymentMethod, formData } = body

    if (!orderId || !price || !formData) {
      return NextResponse.json({ success: false, error: "Dados incompletos." }, { status: 400 })
    }

    const supabase = createServerClient()

    // Busca dados do cliente
    const { data: order } = await supabase
      .from("orders")
      .select("nome, email")
      .eq("id", orderId)
      .single()

    if (!order) {
      return NextResponse.json({ success: false, error: "Pedido não encontrado." }, { status: 404 })
    }

    // Resolve um e-mail VÁLIDO para o pagador.
    // Prioriza o e-mail do pedido (validado na criação); usa o do Brick como fallback.
    const isValidEmail = (e?: string | null) => !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
    const brickEmail   = (formData?.payer?.email ?? "").trim().toLowerCase()
    const orderEmail   = (order.email ?? "").trim().toLowerCase()
    const payerEmail   = isValidEmail(orderEmail) ? orderEmail
                       : isValidEmail(brickEmail) ? brickEmail
                       : ""

    if (!payerEmail) {
      console.error("[create] e-mail inválido — order:", order.email, "brick:", formData?.payer?.email)
      return NextResponse.json({ success: false, error: "E-mail do cliente inválido. Verifique o cadastro do pedido." }, { status: 400 })
    }

    // Busca acréscimo do prazo escolhido
    let priceExtra = 0
    if (deliveryOptionId) {
      const { data: delivery } = await supabase
        .from("product_delivery_options")
        .select("price_extra")
        .eq("id", deliveryOptionId)
        .single()
      if (delivery) priceExtra = Number(delivery.price_extra)
    }

    const finalPrice = Number(price) + priceExtra
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "")
    const isLocalhost = baseUrl.includes("localhost")

    // Cria o pagamento diretamente via API MP
    const paymentClient = new Payment(client)
    const result = await paymentClient.create({
      body: {
        ...formData,
        transaction_amount: finalPrice,
        description: `FizMusica — ${productName}`,
        external_reference: orderId,
        // Só envia notification_url em produção (localhost não é acessível pelo MP)
        ...(!isLocalhost ? { notification_url: `${baseUrl}/api/payments/webhook` } : {}),
        payer: {
          ...formData.payer,
          email: payerEmail,
          first_name: order.nome.split(" ")[0] || "Cliente",
          last_name: order.nome.split(" ").slice(1).join(" ") || ".",
        },
      },
    })

    const mpStatus = result.status // approved | pending | rejected | in_process

    // Atualiza pedido com produto e prazo
    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        productId,
        ...(deliveryOptionId ? { deliveryOptionId } : {}),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (orderUpdateError) console.error("[create] order update error:", orderUpdateError)

    // Salva pagamento
    const { error: paymentError } = await supabase.from("payments").upsert(
      {
        orderId,
        mpPaymentId: String(result.id),
        mpStatus: mpStatus ?? null,
        status: mpStatus === "approved" ? "PAID" : "UNPAID",
        amount: finalPrice,
        paidAt: mpStatus === "approved" ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      },
      { onConflict: "orderId" }
    )

    if (paymentError) console.error("[create] payment upsert error:", paymentError)

    // Atualiza paymentStatus do pedido se aprovado
    if (mpStatus === "approved") {
      const { error: paidError } = await supabase
        .from("orders")
        .update({ paymentStatus: "PAID", updatedAt: new Date().toISOString() })
        .eq("id", orderId)

      if (paidError) console.error("[create] paymentStatus update error:", paidError)
      else console.log(`[create] order ${orderId} marcado como PAID`)
    }

    console.log(`[create] payment ${result.id} — status: ${mpStatus} — order: ${orderId}`)

    return NextResponse.json({
      success: true,
      status: mpStatus,
      paymentId: result.id,
    })
  } catch (err: any) {
    // Extrai mensagem detalhada do MP (400 Bad Request)
    const mpError = err?.cause ?? err?.error ?? err
    const details = typeof mpError === "object" ? JSON.stringify(mpError, null, 2) : String(mpError)
    console.error("[POST /api/payments/create] ERRO COMPLETO:", details)
    const msg = err?.cause?.message ?? err?.message ?? "Erro ao processar pagamento."
    return NextResponse.json({ success: false, error: msg, details }, { status: 500 })
  }
}
