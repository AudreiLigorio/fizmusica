import { NextResponse } from "next/server"
import MercadoPago, { Payment } from "mercadopago"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const token = process.env.MP_ACCESS_TOKEN
    if (!token) return NextResponse.json({ error: "MP_ACCESS_TOKEN não configurado" }, { status: 500 })

    const tokenType = token.startsWith("TEST-") ? "TEST (sandbox)" : "PRODUCTION"
    const baseUrl   = process.env.NEXT_PUBLIC_BASE_URL ?? "(não configurado)"

    const client = new MercadoPago({ accessToken: token })
    const paymentClient = new Payment(client)

    // Tenta criar um PIX de R$ 1,00 real
    const result = await paymentClient.create({
      body: {
        transaction_amount: 1.00,
        description: "Teste diagnóstico PIX",
        payment_method_id: "pix",
        external_reference: "test-diagnostico",
        notification_url: `${baseUrl}/api/payments/webhook`,
        payer: {
          email: "teste@fizmusica.com.br",
          first_name: "Teste",
          last_name: "Diagnostico",
          identification: { type: "CPF", number: "12345678909" },
        },
      },
    })

    return NextResponse.json({
      ok: true,
      tokenType,
      baseUrl,
      status: result.status,
      paymentId: result.id,
      pixQrCode: (result as any).point_of_interaction?.transaction_data?.qr_code ? "gerado ✅" : "não gerado ❌",
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      tokenType: process.env.MP_ACCESS_TOKEN?.startsWith("TEST-") ? "TEST (sandbox)" : "PRODUCTION",
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "(não configurado)",
      error: err?.message ?? String(err),
      cause: err?.cause ?? null,
      details: JSON.stringify(err, null, 2),
    }, { status: 500 })
  }
}
