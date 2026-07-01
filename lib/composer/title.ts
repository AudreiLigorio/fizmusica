import { generateLyrics } from "./gemini"
import { getComposerSettings } from "./settings"

// Gera um título curto e emocionante para a música, a partir da letra.
// Reaproveita o cliente Gemini do compositor. Retorna null em falha (fallback no chamador).
export async function generateMusicTitle(lyrics: string): Promise<string | null> {
  if (!lyrics?.trim()) return null
  try {
    const settings = await getComposerSettings()
    const raw = await generateLyrics({
      systemPrompt:
        "Você cria títulos de músicas. Dado o trecho de uma letra, responda APENAS um título curto " +
        "(2 a 5 palavras), bonito e emocionante, em português, sem aspas, sem pontuação final e sem explicação.",
      model: settings.model,
      location: settings.location,
      userContent: `Crie um título para esta letra:\n\n${lyrics.slice(0, 1500)}`,
    })
    const title = raw.split("\n")[0].replace(/^["'\s]+|["'\s.]+$/g, "").trim()
    return title ? title.slice(0, 60) : null
  } catch {
    return null
  }
}
