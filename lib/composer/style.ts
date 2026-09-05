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
export async function buildSunoStyle(order: OrderForStyle, opts?: { avoid?: string }): Promise<string> {
  const raw = buildStyle(order)
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
        "(gênero, instrumentação, vibe). Sem aspas, sem explicação, no máximo ~12 palavras." + avoidLine,
      userContent: `Converta este pedido em tags de estilo:\n\n${raw.slice(0, 800)}`,
    })
    const cleaned = stripTerm(out.split("\n")[0].replace(/["']/g, "").trim(), opts?.avoid)
    return (cleaned || fallback).slice(0, 200)
  } catch {
    return fallback.slice(0, 200)
  }
}
