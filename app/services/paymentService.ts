import MercadoPago, { Preference } from "mercadopago"

const client = new MercadoPago({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

const preference = new Preference(client)

interface CreatePreferenceParams {
  orderId: string
  productId: string
  productName: string
  price: number
  buyerName: string
  buyerEmail: string
}

export async function createPaymentPreference(params: CreatePreferenceParams) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
  const isLocalhost = baseUrl.includes("localhost")

  const result = await preference.create({
    body: {
      external_reference: params.orderId,
      items: [
        {
          id: params.productId,
          title: `FizMusica — ${params.productName}`,
          quantity: 1,
          unit_price: params.price,
          currency_id: "BRL",
        },
      ],
      payer: {
        name: params.buyerName,
        email: params.buyerEmail,
      },
      back_urls: {
        success: `${baseUrl}/sucesso?orderId=${params.orderId}`,
        failure: `${baseUrl}/produtos?orderId=${params.orderId}&erro=pagamento`,
        pending: `${baseUrl}/sucesso?orderId=${params.orderId}&status=pending`,
      },
      ...(isLocalhost ? {} : { auto_return: "approved" }),
      notification_url: `${baseUrl}/api/payments/webhook`,
    },
  })

  return {
    preferenceId: result.id!,
    checkoutUrl: result.init_point!,
    sandboxUrl: result.sandbox_init_point!,
  }
}
