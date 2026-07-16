import type { createServerClient } from "@/lib/supabase"
import { sendMusicDeliveryEmail, sendMusicReadyForReviewNotification } from "@/app/services/emailService"
import { getActivePublicCoupon, couponLabel } from "@/lib/coupons"

type DB = ReturnType<typeof createServerClient>

// Modo "com aprovação": a música ficou READY aguardando o admin liberar. Avisa o admin
// por e-mail (senão ele só descobre abrindo o painel de Produção).
export async function notifyAdminReviewNeeded(supabase: DB, orderId: string): Promise<void> {
  try {
    const { data: order } = await supabase
      .from("orders").select("nome, subcategory").eq("id", orderId).maybeSingle()
    await sendMusicReadyForReviewNotification({
      orderId,
      nome: order?.nome ?? "Cliente",
      subcategory: order?.subcategory ?? null,
    })
  } catch (e) {
    console.error("[notifyAdminReviewNeeded] erro:", e instanceof Error ? e.message : e)
  }
}

// E-mail "sua música está pronta" — NÃO anexa a música; direciona o cliente a
// ouvir/baixar na sua área (após o Termo de Entrega). Disparado quando as
// versões são LIBERADAS (modo automático no ingest, ou modo "com aprovação"
// quando o admin libera).
export async function notifyMusicReady(supabase: DB, orderId: string): Promise<void> {
  try {
    const { data: order } = await supabase
      .from("orders").select("nome, email, photo_token").eq("id", orderId).maybeSingle()
    if (!order?.email) return

    const { data: gm } = await supabase
      .from("generated_music").select("musicName, personName").eq("orderId", orderId).maybeSingle()

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"
    // Link de token (sem login) leva o cliente direto a escolher a versão e ouvir.
    // Fallback pra área com login caso o pedido não tenha photo_token (legados).
    const areaUrl = order.photo_token
      ? `${baseUrl}/preparar/${order.photo_token}`
      : `${baseUrl}/minha-musica?orderId=${orderId}`
    const promo = await getActivePublicCoupon(supabase)
    const r = await sendMusicDeliveryEmail({
      nome:      order.nome ?? "",
      email:     order.email,
      musicName: gm?.musicName || gm?.personName || "sua música",
      areaUrl,
      orderId,
      loyaltyCoupon: promo ? { code: promo.code, label: couponLabel(promo) } : null,
    })
    if (!r.ok) console.error("[notifyMusicReady] e-mail falhou:", r.error)
  } catch (e) {
    console.error("[notifyMusicReady] erro:", e instanceof Error ? e.message : e)
  }
}
