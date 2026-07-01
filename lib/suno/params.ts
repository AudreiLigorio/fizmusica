// Mapeia os dados do pedido para os parâmetros de geração do Suno.

type OrderForSuno = {
  musicalStyle?: string | null
  voiceType?: string | null
  emotion?: string | null
  honoreeName?: string | null
  nome?: string | null
  subcategory?: string | null
  revision_note?: string | null   // instrução do cliente, em pedidos de revisão
}

// Voz: o wizard usa "Masculina"/"Feminina". Em revisão, a instrução do cliente
// ("voz feminina") tem prioridade sobre o voiceType original.
export function mapVocalGender(order: OrderForSuno): "m" | "f" | undefined {
  const note = (order.revision_note ?? "").toLowerCase()
  if (/voz\s+feminina|feminina|mulher/.test(note)) return "f"
  if (/voz\s+masculina|masculina|homem/.test(note)) return "m"

  const v = (order.voiceType ?? "").toLowerCase()
  if (v.includes("masc") || v.includes("homem") || v.startsWith("m")) return "m"
  if (v.includes("fem") || v.includes("mulher") || v.startsWith("f")) return "f"
  return undefined
}

// Style do Suno = estilo musical + emoção. Em revisão, anexa a instrução do cliente
// (ex: "mais lenta") para o Suno aplicar o ajuste pedido.
export function buildStyle(order: OrderForSuno): string {
  const base = [order.musicalStyle, order.emotion].map((s) => (s ?? "").trim()).filter(Boolean).join(", ")
  const note = (order.revision_note ?? "").trim()
  return note ? [base, `Ajustes pedidos: ${note}`].filter(Boolean).join(". ") : base
}

// Título: nome do homenageado ou ocasião como fallback.
export function buildTitle(order: OrderForSuno): string {
  const base = order.honoreeName?.trim() || order.nome?.trim() || order.subcategory?.trim() || "Música personalizada"
  return base.slice(0, 80)
}
