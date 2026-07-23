import type { createServerClient } from "@/lib/supabase"
import { triggerN8nWebhook } from "@/app/services/orderService"

type DB = ReturnType<typeof createServerClient>

// O wizard grava no formato "(11) 99664-5678". A API do WhatsApp quer só dígitos
// com DDI. Celular BR tem 11 dígitos (DDD + 9); se já vier com o 55, não duplica.
export function toE164(whatsapp: string | null | undefined): string {
  const d = (whatsapp ?? "").replace(/\D/g, "")
  if (!d) return ""
  if (d.length === 11 || d.length === 10) return `55${d}`
  return d
}

// Campos de contato usados por todos os eventos de entrega.
async function loadContact(supabase: DB, orderId: string) {
  const { data } = await supabase
    .from("orders")
    .select("nome, email, whatsapp, subcategory, musicalStyle")
    .eq("id", orderId)
    .maybeSingle()
  return data
}

// "Sua música está pronta" no WhatsApp. Chamado dos DOIS caminhos de entrega:
// o fluxo Suno (notifyMusicReady, via liberar manual ou auto-release do ingest)
// e a entrega manual legada (/admin/producao/[id]/entregar).
export async function notifyN8nMusicDelivered(
  supabase: DB,
  orderId: string,
  opts: { publicUrl: string; musicName?: string | null },
): Promise<void> {
  const order = await loadContact(supabase, orderId)
  if (!order?.whatsapp) return

  await triggerN8nWebhook({
    event:        "music.delivered",
    orderId,
    nome:         order.nome ?? "",
    email:        order.email ?? "",
    whatsapp:     order.whatsapp,
    whatsappE164: toE164(order.whatsapp),
    subcategory:  order.subcategory ?? "",
    musicalStyle: order.musicalStyle ?? "",
    createdAt:    new Date().toISOString(),
    publicUrl:    opts.publicUrl,
    musicName:    opts.musicName?.trim() || "sua música",
  })
}

// Pedido de avaliação no WhatsApp. Sai junto com o e-mail de feedback (cron),
// que é o ponto único onde o cliente é convidado a avaliar — e é idempotente
// porque o cron marca `email_sent` depois de processar.
export async function notifyN8nFeedbackRequest(
  supabase: DB,
  orderId: string,
  opts: { feedbackUrl: string; musicName?: string | null },
): Promise<void> {
  const order = await loadContact(supabase, orderId)
  if (!order?.whatsapp) return

  await triggerN8nWebhook({
    event:        "feedback.request",
    orderId,
    nome:         order.nome ?? "",
    email:        order.email ?? "",
    whatsapp:     order.whatsapp,
    whatsappE164: toE164(order.whatsapp),
    subcategory:  order.subcategory ?? "",
    musicalStyle: order.musicalStyle ?? "",
    createdAt:    new Date().toISOString(),
    feedbackUrl:  opts.feedbackUrl,
    publicUrl:    opts.feedbackUrl,
    musicName:    opts.musicName?.trim() || "sua música",
  })
}
