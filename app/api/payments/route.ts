import { NextResponse } from "next/server"
import { createPaymentPreference } from "@/app/services/paymentService"
import { createServerClient } from "@/lib/supabase"
import { createPaymentSchema } from "@/lib/validators/payment"

export async function POST(req: Request) {
  try {
    const raw = await req.json()
    const parsed = createPaymentSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { orderId, productId, productName, price, deliveryOptionId } = parsed.data

    const supabase = createServerClient()

    // Busca dados do cliente para pré-preencher o checkout
    const { data: order, error } = await supabase
      .from("orders")
      .select("nome, email")
      .eq("id", orderId)
      .single()

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: "Pedido não encontrado." },
        { status: 404 }
      )
    }

    // Busca acréscimo da opção de entrega escolhida
    let priceExtra = 0
    let deliveryLabel: string | null = null

    if (deliveryOptionId) {
      const { data: deliveryOption } = await supabase
        .from("product_delivery_options")
        .select("price_extra, label")
        .eq("id", deliveryOptionId)
        .single()

      if (deliveryOption) {
        priceExtra = Number(deliveryOption.price_extra)
        deliveryLabel = deliveryOption.label
      }
    }

    const finalPrice = Number(price) + priceExtra

    const result = await createPaymentPreference({
      orderId,
      productId,
      productName: deliveryLabel ? `${productName} — ${deliveryLabel}` : productName,
      price: finalPrice,
      buyerName: order.nome,
      buyerEmail: order.email,
    })

    // Associa produto + prazo + preferência ao pedido
    await supabase
      .from("orders")
      .update({
        productId: productId,
        ...(deliveryOptionId ? { deliveryOptionId } : {}),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", orderId)

    // Cria registro de pagamento pendente com o preferenceId
    await supabase.from("payments").upsert(
      {
        orderId,
        mpPreferenceId: result.preferenceId,
        status: "UNPAID",
        amount: finalPrice,
        updatedAt: new Date().toISOString(),
      },
      { onConflict: "orderId" }
    )

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error("[POST /api/payments]", err)
    return NextResponse.json(
      { success: false, error: "Erro ao criar preferência de pagamento." },
      { status: 500 }
    )
  }
}
