import { NextResponse } from "next/server"
import MercadoPago, { Payment } from "mercadopago"
import { createServerClient } from "@/lib/supabase"
import { detectDuplicatePayment } from "@/lib/paymentAlerts"
import { validateCoupon } from "@/lib/coupons"
import { concederDiscosDoPedido } from "@/lib/fidelidade"

const client = new MercadoPago({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { orderId, productId, deliveryOptionId, paymentMethod, formData, couponCode } = body

    if (!orderId || !productId || !formData) {
      return NextResponse.json({ success: false, error: "Dados incompletos." }, { status: 400 })
    }

    const supabase = createServerClient()

    // Busca dados do cliente
    const { data: order } = await supabase
      .from("orders")
      .select("nome, email, paymentStatus")
      .eq("id", orderId)
      .single()

    if (!order) {
      return NextResponse.json({ success: false, error: "Pedido não encontrado." }, { status: 404 })
    }

    // Fix 1: preço vem SEMPRE do banco (não confia no client)
    const { data: product } = await supabase
      .from("products")
      .select("name, price")
      .eq("id", productId)
      .single()

    if (!product) {
      return NextResponse.json({ success: false, error: "Produto inválido." }, { status: 400 })
    }
    const productName = product.name

    // Anti-duplo-pagamento: se o pedido já está pago, não cria nova cobrança no MP
    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        { success: false, alreadyPaid: true, error: "Este pedido já foi pago." },
        { status: 409 }
      )
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

    const grossPrice = Number(product.price) + priceExtra

    // Aplica cupom (validado no servidor — não confia no client)
    let finalPrice = grossPrice
    let appliedCouponCode: string | null = null
    let discountAmount = 0
    if (couponCode) {
      const cv = await validateCoupon(supabase, String(couponCode), grossPrice)
      if (cv.valid) {
        finalPrice        = cv.finalTotal
        discountAmount    = cv.discount
        appliedCouponCode = cv.coupon.code
      }
    }

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "")
    const isLocalhost = baseUrl.includes("localhost")

    const paymentClient = new Payment(client)

    // Fix 2: cancela a cobrança PIX anterior deste pedido (se ainda pendente)
    // para não deixar dois QRs pagáveis quando o cliente volta e troca o produto.
    const { data: prevPayment } = await supabase
      .from("payments")
      .select("mpPaymentId, status")
      .eq("orderId", orderId)
      .maybeSingle()

    if (prevPayment?.mpPaymentId && prevPayment.status !== "PAID") {
      try {
        const prev = await paymentClient.get({ id: prevPayment.mpPaymentId })
        if (prev.status === "pending" || prev.status === "in_process") {
          await paymentClient.cancel({ id: prevPayment.mpPaymentId })
          console.log(`[create] PIX anterior ${prevPayment.mpPaymentId} cancelado (troca de produto)`)
        }
      } catch (cancelErr: any) {
        console.warn(`[create] não foi possível cancelar PIX anterior:`, cancelErr?.message ?? cancelErr)
      }
    }

    // Cria o pagamento diretamente via API MP
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

    // Anti-duplicidade (corrida): se já há pagamento PAID com outro id, registra alerta
    // e NÃO sobrescreve o original. O cliente foi cobrado — admin precisa estornar.
    if (mpStatus === "approved") {
      const dup = await detectDuplicatePayment(supabase, orderId, String(result.id), finalPrice)
      if (dup) {
        return NextResponse.json({ success: false, alreadyPaid: true, error: "Este pedido já foi pago." }, { status: 409 })
      }
    }

    // Atualiza pedido com produto e prazo
    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        productId,
        ...(deliveryOptionId ? { deliveryOptionId } : {}),
        ...(appliedCouponCode ? { coupon_code: appliedCouponCode, discount_amount: discountAmount } : {}),
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
        productId,                                    // Fix 3: produto vinculado a ESTA cobrança
        ...(deliveryOptionId ? { deliveryOptionId } : {}),
        paidAt: mpStatus === "approved" ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      },
      { onConflict: "orderId" }
    )

    if (paymentError) console.error("[create] payment upsert error:", paymentError)

    // Rede de segurança: se o e-mail do checkout (pagador) é válido e DIFERE do
    // e-mail do pedido, guarda-o para também enviar o link de acesso para lá.
    // Best-effort: se a coluna ainda não existe (migração 019 pendente), apenas loga.
    if (isValidEmail(brickEmail) && brickEmail !== orderEmail) {
      const { error: peErr } = await supabase
        .from("payments")
        .update({ payer_email: brickEmail })
        .eq("orderId", orderId)
      if (peErr) console.warn("[create] payer_email não salvo (migração 019 pendente?):", peErr.message)
    }

    // Atualiza paymentStatus do pedido se aprovado
    if (mpStatus === "approved") {
      const { error: paidError } = await supabase
        .from("orders")
        .update({ paymentStatus: "PAID", updatedAt: new Date().toISOString() })
        .eq("id", orderId)

      if (paidError) console.error("[create] paymentStatus update error:", paidError)
      else {
        console.log(`[create] order ${orderId} marcado como PAID`)
        // Único dos seis pontos de confirmação que não passa por
        // ensurePaymentPrep — precisa conceder o disco por conta própria.
        await concederDiscosDoPedido(supabase, orderId)
      }

      // O uso do cupom NÃO é mais incrementado aqui: ele é derivado da contagem
      // de pedidos PAGOS que carregam o coupon_code (ver countCouponUses em
      // lib/coupons.ts). Isso cobre cartão e PIX igualmente, sem duplicar.
    }

    console.log(`[create] payment ${result.id} — status: ${mpStatus} — order: ${orderId}`)

    // Dados do PIX (QR na tela): o MP devolve o QR pronto na resposta do pagamento
    const txData = (result as any)?.point_of_interaction?.transaction_data
    const pix = txData?.qr_code_base64
      ? {
          qrCodeBase64: txData.qr_code_base64 as string,
          qrCode:       txData.qr_code as string,
          ticketUrl:    (txData.ticket_url as string) ?? null,
        }
      : null

    return NextResponse.json({
      success: true,
      status: mpStatus,
      paymentId: result.id,
      pix,
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
