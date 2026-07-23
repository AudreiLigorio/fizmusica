import { generateLyrics } from "@/lib/composer/gemini"
import { getComposerSettings } from "@/lib/composer/settings"

export type CaptionSource =
  | { type: "pedido"; musicName: string; subcategory: string; lyricsExcerpt: string; platform: string }
  | { type: "generico"; topic: string; platform: string }

export type CaptionResult = {
  caption: string
  hashtags: string
  promptUsed: string
}

const SYSTEM_PROMPT =
  "Você escreve legendas de post para redes sociais (Instagram, TikTok, YouTube) da FizMusica, " +
  "uma empresa que cria músicas personalizadas por encomenda. Responda em português, tom caloroso " +
  "e emocional (não corporativo). Formato da resposta, sem nenhum texto extra:\n" +
  "LEGENDA: <legenda de até 4 frases>\n" +
  "HASHTAGS: <5 a 8 hashtags separadas por espaço, começando com #, em português>"

function buildUserContent(source: CaptionSource): string {
  if (source.type === "pedido") {
    return (
      `Plataforma: ${source.platform}\n` +
      `Tipo de música: ${source.subcategory}\n` +
      `Nome da música: ${source.musicName}\n` +
      `Trecho da letra (inspiração, não copiar literalmente):\n${source.lyricsExcerpt.slice(0, 800)}`
    )
  }
  return `Plataforma: ${source.platform}\nTema livre de marketing: ${source.topic}`
}

function parseResponse(raw: string): { caption: string; hashtags: string } {
  const captionMatch = raw.match(/LEGENDA:\s*([\s\S]*?)(?:\nHASHTAGS:|$)/i)
  const hashtagsMatch = raw.match(/HASHTAGS:\s*([\s\S]*)/i)
  const caption = (captionMatch?.[1] ?? raw).trim()
  const hashtags = (hashtagsMatch?.[1] ?? "").trim()
  if (!caption) throw new Error("A IA não retornou legenda.")
  return { caption, hashtags }
}

// Gera legenda + hashtags via Gemini. Reaproveita o mesmo cliente/config do
// compositor de letras (lib/composer/gemini.ts) — mesma conta, model/location
// configuráveis pelo admin.
export async function generateCaption(source: CaptionSource): Promise<CaptionResult> {
  const settings = await getComposerSettings()
  const userContent = buildUserContent(source)

  const raw = await generateLyrics({
    systemPrompt: SYSTEM_PROMPT,
    model: settings.model,
    location: settings.location,
    userContent,
  })

  const { caption, hashtags } = parseResponse(raw)
  return { caption, hashtags, promptUsed: userContent }
}
