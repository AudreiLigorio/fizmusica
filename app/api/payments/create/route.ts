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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
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
          email: formData.payer?.email || order.email,
          first_name: order.nome.split(" ")[0],
          last_name: order.nome.split(" ").slice(1).join(" ") || ".",
        },
      },
    })

    const mpStatus = result.status // approved | pending | rejected | in_process

    // Atualiza pedido com produto e prazo
    await supabase
      .from("orders")
      .update({
        productId,
        ...(deliveryOptionId ? { deliveryOptionId } : {}),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", orderId)

    // Salva pagamento
    await supabase.from("payments").upsert(
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

    // Atualiza paymentStatus do pedido se aprovado
    if (mpStatus === "approved") {
      await supabase
        .from("orders")
        .update({ paymentStatus: "PAID", updatedAt: new Date().toISOString() })
        .eq("id", orderId)
    }

    return NextResponse.json({
      success: true,
      status: mpStatus,
      paymentId: result.id,
    })
  } catch (err: any) {
    console.error("[POST /api/payments/create]", err)
    const msg = err?.cause?.message ?? err?.message ?? "Erro ao processar pagamento."
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
