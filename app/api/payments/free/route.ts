import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { validateCoupon } from "@/lib/coupons"
import { ensurePaymentPrep } from "@/lib/payments/prep"

// Conclui um pedido cujo total foi ZERADO por um cupom (ex.: cupom 100% de teste
// do youtuber). O Mercado Pago não aceita cobrança de R$ 0, então este caminho
// pula o MP e marca o pedido como pago diretamente — SEMPRE exigindo um cupom
// válido que zere o total (validado no servidor). Reaproveita a mesma preparação
// pós-pagamento (token + e-mail "aprove a letra") dos caminhos pagos.
export async function POST(req: Request) {
  try {
    const { orderId, productId, deliveryOptionId, couponCode } = await req.json()
    if (!orderId || !productId || !couponCode) {
      return NextResponse.json({ success: false, error: "Dados incompletos." }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: order } = await supabase
      .from("orders")
      .select("id, paymentStatus")
      .eq("id", orderId)
      .single()
    if (!order) return NextResponse.json({ success: false, error: "Pedido não encontrado." }, { status: 404 })

    // Idempotente: pedido já pago → segue pro sucesso sem refazer nada
    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ success: true, alreadyPaid: true })
    }

    // Preço SEMPRE do banco (nunca confia no client)
    const { data: product } = await supabase.from("products").select("price").eq("id", productId).single()
    if (!product) return NextResponse.json({ success: false, error: "Produto inválido." }, { status: 400 })

    let priceExtra = 0
    if (deliveryOptionId) {
      const { data: d } = await supabase
        .from("product_delivery_options")
        .select("price_extra")
        .eq("id", deliveryOptionId)
        .single()
      if (d) priceExtra = Number(d.price_extra)
    }
    const grossPrice = Number(product.price) + priceExtra

    // Valida o cupom no servidor: ativo, não expirado, não esgotado (usos derivados
    // dos pedidos pagos — respeita o "Máx. de usos" do cupom) e pedido mínimo.
    const cv = await validateCoupon(supabase, String(couponCode), grossPrice)
    if (!cv.valid) return NextResponse.json({ success: false, error: cv.reason }, { status: 400 })

    // Só é "grátis" se o cupom REALMENTE zera o total. Senão, exige pagamento normal.
    if (cv.finalTotal > 0) {
      return NextResponse.json(
        { success: false, error: "Este cupom não zera o total. Use o pagamento normal." },
        { status: 400 }
      )
    }

    // Marca o pedido como pago (grátis) + grava a atribuição do cupom
    await supabase
      .from("orders")
      .update({
        productId,
        ...(deliveryOptionId ? { deliveryOptionId } : {}),
        coupon_code: cv.coupon.code,
        discount_amount: cv.discount,
        paymentStatus: "PAID",
        updatedAt: new Date().toISOString(),
      })
      .eq("id", orderId)

    // Registro de pagamento R$ 0 — aparece no relatório como "teste grátis"
    await supabase.from("payments").upsert(
      {
        orderId,
        mpPaymentId: `FREE-${orderId}`,
        mpStatus: "approved",
        status: "PAID",
        amount: 0,
        productId,
        ...(deliveryOptionId ? { deliveryOptionId } : {}),
        paidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { onConflict: "orderId" }
    )

    // Mesma preparação pós-pagamento dos caminhos pagos (idempotente): gera o
    // photo_token e envia o e-mail "aprove a letra" pra seguir a jornada.
    await ensurePaymentPrep(supabase, orderId)

    console.log(`[free] order ${orderId} liberado grátis via cupom ${cv.coupon.code}`)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[POST /api/payments/free]", err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: "Erro ao concluir o pedido grátis." }, { status: 500 })
  }
}
