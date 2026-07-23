import { generateLyrics } from "@/lib/composer/gemini"
import { getComposerSettings } from "@/lib/composer/settings"

export type SongLyricsResult = {
  title: string
  lyrics: string // com tags [Verse]/[Pre-Chorus]/[Chorus], formato Suno
}

const SYSTEM_PROMPT =
  "Você escreve letras de música em português para a FizMusica (músicas personalizadas por " +
  "encomenda), no formato que o Suno.ai espera: seções marcadas com [Verse], [Pre-Chorus] e " +
  "[Chorus]. A letra deve ter uma construção emocional crescente — começa mais contida e cresce " +
  "até o [Chorus], que é o ponto mais forte/vibrante da música (isso importa: o vídeo final vai " +
  "sincronizar visualmente com esse clímax). Responda em português, sem explicação, só a letra. " +
  "Formato exato da resposta, sem nenhum texto extra:\n" +
  "TITULO: <título curto da música>\n" +
  "LETRA:\n[Verse]\n<versos>\n\n[Pre-Chorus]\n<versos>\n\n[Chorus]\n<versos>"

// Gera letra estruturada (com clímax no Chorus) via Gemini, a partir de um
// tema/estilo livre. Reaproveita o mesmo cliente/config do compositor de
// letras (lib/composer/gemini.ts) — mesmo padrão de lib/content/caption.ts.
export async function generateSongLyrics(songTheme: string, songStyle: string): Promise<SongLyricsResult> {
  const settings = await getComposerSettings()

  const raw = await generateLyrics({
    systemPrompt: SYSTEM_PROMPT,
    model: settings.model,
    location: settings.location,
    userContent: `Tema da música: ${songTheme}\nEstilo/gênero: ${songStyle}`,
  })

  const titleMatch = raw.match(/TITULO:\s*(.*)/i)
  const lyricsMatch = raw.match(/LETRA:\s*([\s\S]*)/i)
  const title = (titleMatch?.[1] ?? "Minha Música").trim()
  const lyrics = (lyricsMatch?.[1] ?? raw).trim()

  if (!lyrics) throw new Error("A IA não retornou letra.")
  return { title, lyrics }
}
