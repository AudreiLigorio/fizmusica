import { createServerClient } from "@/lib/supabase"

// Monta o bloco de contexto que vai junto do prompt do compositor: ocasião,
// preferências musicais e todas as perguntas/respostas do wizard daquele pedido.
export async function buildOrderContext(orderId: string): Promise<string | null> {
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("nome, context, subcategory, musicalStyle, voiceType, emotion, honoreeName")
    .eq("id", orderId)
    .single()

  if (!order) return null

  const { data: answers } = await supabase
    .from("order_answers")
    .select("question, answer, position")
    .eq("orderId", orderId)
    .order("position", { ascending: true })

  const lines: string[] = [
    `OCASIÃO: ${order.context}${order.subcategory ? ` — ${order.subcategory}` : ""}`,
    order.honoreeName ? `HOMENAGEADO(A): ${order.honoreeName}` : "",
    `ESTILO MUSICAL: ${order.musicalStyle}`,
    `TIPO DE VOZ: ${order.voiceType}`,
    `EMOÇÃO: ${order.emotion}`,
    "",
    "RESPOSTAS DO CLIENTE:",
    ...(answers ?? []).map((a) => `- ${a.question}\n  ${a.answer}`),
  ].filter((l) => l !== "")

  return lines.join("\n")
}
