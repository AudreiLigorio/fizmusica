import { generateLyrics } from "./gemini"
import { getComposerSettings } from "./settings"

// Gera um título curto e emocionante para a música, a partir da letra.
// Reaproveita o cliente Gemini do compositor. Retorna null em falha (fallback no chamador).
//
// Sem nomes próprios de propósito: o título é o que aparece publicamente na
// Rede Fiz Música, e o homenageado é um terceiro que nunca consentiu em ter o
// nome divulgado. Se o cliente escrever um nome à mão, aí é escolha dele —
// coberta pelo termo de publicação que ele aceita.
export async function generateMusicTitle(lyrics: string): Promise<string | null> {
  if (!lyrics?.trim()) return null
  try {
    const settings = await getComposerSettings()
    const raw = await generateLyrics({
      systemPrompt:
        "Você cria títulos de músicas. Dado o trecho de uma letra, responda APENAS um título curto " +
        "(2 a 5 palavras), bonito e emocionante, em português, sem aspas, sem pontuação final e sem explicação. " +
        "NUNCA use nomes próprios de pessoas no título, mesmo que apareçam na letra — descreva o sentimento, " +
        "a relação ou a cena (ex.: \"Meu Porto Seguro\", \"O Abraço que Ficou\"), nunca a identidade de alguém.",
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
