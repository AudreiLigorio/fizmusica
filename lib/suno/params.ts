// Mapeia os dados do pedido para os parâmetros de geração do Suno.

type OrderForSuno = {
  musicalStyle?: string | null
  voiceType?: string | null
  emotion?: string | null
  honoreeName?: string | null
  nome?: string | null
  subcategory?: string | null
  revision_note?: string | null   // instrução do cliente, em pedidos de revisão
  style_reference?: string | null // referência livre do wizard ("tipo Legião Urbana")
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
  // A referência do cliente entra AQUI, não no prompt do Suno: este texto é
  // a entrada do tradutor (buildSunoStyle), que converte "tipo Legião
  // Urbana" em características sonoras e joga o nome fora. Mandar o nome
  // direto faria o Suno recusar a geração inteira.
  const ref = (order.style_reference ?? "").trim()
  const partes = [base]
  if (ref) partes.push(`Referência do cliente: ${ref}`)
  const note = (order.revision_note ?? "").trim()
  if (note) partes.push(`Ajustes pedidos: ${note}`)
  return partes.filter(Boolean).join(". ")
}

// Título: nome do homenageado ou ocasião como fallback.
export function buildTitle(order: OrderForSuno): string {
  const base = order.honoreeName?.trim() || order.nome?.trim() || order.subcategory?.trim() || "Música personalizada"
  return base.slice(0, 80)
}
