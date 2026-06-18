import { createServerClient } from "@/lib/supabase"
import type { CreateOrderDTO, N8nOrderWebhookPayload } from "@/app/types/order"

export async function createOrder(data: CreateOrderDTO) {
  const supabase = createServerClient()

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      nome: data.nome,
      email: data.email,
      whatsapp: data.whatsapp,
      context: data.context,
      subcategory: data.subcategory,
      musicalStyle: data.musicalStyle,
      voiceType: data.voiceType,
      emotion: data.emotion,
      honoreeName: data.honoreeName ?? null,
      terms_accepted_at: data.termsAccepted ? new Date().toISOString() : null,
      terms_version: data.termsAccepted ? (data.termsVersion ?? "2026-06") : null,
      honoree_consent: data.honoreeConsent ?? false,
      status: "PENDING",
      paymentStatus: "UNPAID",
      updatedAt: new Date().toISOString(),
    })
    .select("id, nome, email, whatsapp, context, subcategory, musicalStyle, voiceType, emotion, createdAt")
    .single()

  if (error) throw error

  const answers = data.answers.map((a) => ({
    orderId: order.id,
    question: a.question,
    answer: a.answer,
    position: a.position,
    context: a.context,
    subcategory: a.subcategory,
  }))

  const { error: answersError } = await supabase.from("order_answers").insert(answers)

  if (answersError) throw answersError

  return {
    id: order.id,
    nome: order.nome,
    email: order.email,
    whatsapp: order.whatsapp,
    context: order.context,
    subcategory: order.subcategory,
    musicalStyle: order.musicalStyle,
    voiceType: order.voiceType,
    emotion: order.emotion,
    createdAt: new Date(order.createdAt),
  }
}

export async function getOrderById(id: string) {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("orders")
    .select(`*, order_answers(*), payments(*), generated_music(*), products(*)`)
    .eq("id", id)
    .single()

  if (error) throw error
  return data
}

export async function triggerN8nWebhook(payload: N8nOrderWebhookPayload): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL

  if (!url) {
    console.log("[n8n] N8N_WEBHOOK_URL não configurada — pulando webhook")
    return
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      console.error(`[n8n] Webhook retornou ${res.status}`)
    } else {
      console.log("[n8n] Webhook disparado com sucesso")
    }
  } catch (err) {
    console.error("[n8n] Falha ao disparar webhook:", err)
  }
}
