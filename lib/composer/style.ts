import { generateLyrics } from "./gemini"
import { getComposerSettings } from "./settings"
import { buildStyle } from "@/lib/suno/params"

type OrderForStyle = {
  musicalStyle?: string | null
  voiceType?: string | null
  emotion?: string | null
  honoreeName?: string | null
  nome?: string | null
  subcategory?: string | null
  revision_note?: string | null
  style_reference?: string | null
}

// Remove ocorrências (case-insensitive) de um termo do estilo — usado quando o Suno
// bloqueia uma palavra específica (ex.: nome de artista) e precisamos regenerar sem ela.
function stripTerm(style: string, term?: string): string {
  if (!term) return style
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return style.replace(new RegExp(safe, "ig"), "").replace(/\s*,\s*,\s*/g, ", ").replace(/(^[,\s]+|[,\s]+$)/g, "").trim()
}

// Converte o pedido do cliente em TAGS de estilo seguras para o Suno: descreve o som
// (gênero, instrumentos, energia, vocal) e NUNCA cita artistas — se o cliente pedir
// "estilo Oficina G3", a IA traduz para as características sonoras. Fallback determinístico
// (params.buildStyle) caso a IA não esteja disponível.
// Voz escolhida no wizard ("👩 Feminina" / "👨 Masculina").
function vozEscolhida(order: OrderForStyle): "feminina" | "masculina" | null {
  const v = (order.voiceType ?? "").toLowerCase()
  if (v.includes("fem")) return "feminina"
  if (v.includes("masc")) return "masculina"
  return null
}

// A voz que o cliente ESCOLHEU manda — nunca a da referência. Em 24/11/2026
// o pedido "Feminina + referência Coldplay" saiu com "voz masculina" no
// estilo: a voz não entrava no texto que vai pro tradutor, e ele deduziu o
// vocal pelo cantor da banda. O Suno recebe o vocalGender à parte, mas o
// texto do estilo pesa — os dois sinais brigavam.
// Garantia final, depois da IA: troca o gênero oposto e, se o texto não falar
// de voz nenhuma, acrescenta a escolhida.
export function garantirVoz(estilo: string, voz: "feminina" | "masculina" | null): string {
  if (!voz) return estilo
  const fem = voz === "feminina"
  let out = estilo
    .replace(fem ? /masculin([ao]s?)/gi : /feminin([ao]s?)/gi, (_m, fim: string) => (fem ? "feminin" : "masculin") + fim)
    .replace(fem ? /\bcantor\b/gi : /\bcantora\b/gi, fem ? "cantora" : "cantor")
  if (!/\b(voz|vocal|vocais|cantor|cantora)\b/i.test(out)) out = `${out.replace(/[\s,.]+$/, "")}, voz ${voz}`
  return out
}

export async function buildSunoStyle(order: OrderForStyle, opts?: { avoid?: string }): Promise<string> {
  const voz = vozEscolhida(order)
  const raw = [buildStyle(order), voz ? `Voz escolhida pelo cliente: ${voz} (obrigatória)` : ""].filter(Boolean).join(". ")
  const fallback = stripTerm(raw, opts?.avoid) || "Pop"

  if (!raw.trim()) return fallback

  try {
    const settings = await getComposerSettings()
    const avoidLine = opts?.avoid ? `\nNão inclua de forma alguma o termo: "${opts.avoid}".` : ""
    const out = await generateLyrics({
      model: settings.model,
      location: settings.location,
      systemPrompt:
        "Você converte um pedido de música em TAGS de estilo para um gerador de música (Suno). " +
        "Responda APENAS as tags separadas por vírgula, em português, descrevendo gênero, instrumentos, " +
        "andamento, energia e tipo de vocal. NUNCA cite nomes de artistas, bandas, cantores ou músicas " +
        "específicas — se o pedido mencionar um artista, traduza para as características sonoras dele " +
        "(gênero, instrumentação, vibe). Se o pedido trouxer a voz escolhida pelo cliente, use EXATAMENTE " +
        "esse tipo de vocal, mesmo que o artista de referência tenha outro. " +
        "Sem aspas, sem explicação, no máximo ~12 palavras." + avoidLine,
      userContent: `Converta este pedido em tags de estilo:\n\n${raw.slice(0, 800)}`,
    })
    const cleaned = stripTerm(out.split("\n")[0].replace(/["']/g, "").trim(), opts?.avoid)
    return garantirVoz(cleaned || fallback, voz).slice(0, 200)
  } catch {
    return garantirVoz(fallback, voz).slice(0, 200)
  }
}
