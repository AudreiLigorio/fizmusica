import type { createServerClient } from "@/lib/supabase"
import { sendPaymentConfirmedEmail } from "@/app/services/emailService"
import { logOrderEvent } from "@/lib/orderEvents"
import crypto from "crypto"

type DB = ReturnType<typeof createServerClient>

// Idempotente: na PRIMEIRA confirmação de pagamento, gera o photo_token e envia o
// e-mail "aprove sua letra" (link tokenizado /preparar, sem login). Usado tanto
// pela rota de retorno (/api/payments/confirm) quanto pelo webhook do Mercado Pago,
// para que quem paga PIX e fecha a aba também receba o convite de ação.
//
// O claim do token é ATÔMICO (update ... where photo_token IS NULL): só "ganha" um
// dos caminhos, garantindo que o e-mail seja enviado uma única vez sem corrida.
export async function ensurePaymentPrep(supabase: DB, orderId: string): Promise<void> {
  const token = crypto.randomUUID()
  const { data: claimed, error } = await supabase
    .from("orders")
    .update({ photo_token: token })
    .eq("id", orderId)
    .is("photo_token", null)
    .select("nome, email, photo_token")

  if (error) {
    console.error("[prep] falha ao reivindicar photo_token:", error.message)
    return
  }
  if (!claimed || claimed.length === 0) return // já preparado por outro caminho

  const o = claimed[0]
  await logOrderEvent(supabase, orderId, "pagamento_confirmado")
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"
  const prepUrl = `${baseUrl}/preparar/${o.photo_token}`
  const r = await sendPaymentConfirmedEmail({ nome: o.nome, email: o.email, prepUrl })
  if (!r.ok) console.error("[prep] e-mail 'aprovar letra' falhou:", r.error)

  // Rede de segurança: se o cliente pagou com um e-mail diferente do wizard, envia
  // o link de acesso para lá também. Defensivo: se a coluna payer_email ainda não
  // existe (migração 019 pendente), o select retorna erro e seguimos sem o 2º envio.
  const { data: pay } = await supabase
    .from("payments")
    .select("payer_email")
    .eq("orderId", orderId)
    .maybeSingle()
  const payerEmail = (pay as { payer_email?: string | null } | null)?.payer_email?.trim().toLowerCase()
  if (payerEmail && payerEmail !== (o.email ?? "").trim().toLowerCase()) {
    const r2 = await sendPaymentConfirmedEmail({ nome: o.nome, email: payerEmail, prepUrl })
    if (!r2.ok) console.error("[prep] e-mail 'aprovar letra' (pagador) falhou:", r2.error)
  }
}
