import { generateLyrics } from "@/lib/composer/gemini"
import { getComposerSettings } from "@/lib/composer/settings"
import { loadMarca } from "@/lib/content/marca"

export type CaptionSource =
  | { type: "pedido"; musicName: string; subcategory: string; lyricsExcerpt: string; platform: string }
  | { type: "generico"; topic: string; platform: string }

export type CaptionResult = {
  hook: string
  caption: string
  hashtags: string
  promptUsed: string
}

// O system prompt é montado a cada chamada porque injeta a base de
// conhecimento da marca (lib/content/marca) — voz/tom, banco de ganchos e
// regras por rede. Editar aqueles markdowns muda o comportamento do agente
// sem tocar em código.
function buildSystemPrompt(): string {
  return (
    "Você escreve conteúdo de conversão para redes sociais (Instagram, TikTok, YouTube) da FizMusica, " +
    "uma empresa que transforma histórias reais em músicas personalizadas. O que converte em feed é " +
    "imagem com frase curta + legenda direta — não parágrafo longo. Responda em português.\n\n" +
    "Siga RIGOROSAMENTE a base de conhecimento da marca abaixo. Ela tem precedência sobre qualquer " +
    "hábito seu de escrita publicitária:\n\n" +
    "<base_de_conhecimento>\n" +
    loadMarca(["voz", "ganchos", "redes"]) +
    "\n</base_de_conhecimento>\n\n" +
    "Antes de escrever, decida em silêncio: qual persona está falando, qual emoção quer provocar e " +
    "qual gancho interrompe o scroll. Não escreva esse raciocínio na resposta.\n\n" +
    "Formato da resposta, sem nenhum texto extra:\n" +
    "GANCHO: <frase de 4 a 8 palavras, pra queimar na imagem — direta, emocional ou de curiosidade, " +
    "sem ponto final, tipo manchete>\n" +
    "LEGENDA: <no máximo 2 frases curtas, terminando com UMA chamada pra ação clara>\n" +
    "HASHTAGS: <5 a 8 hashtags separadas por espaço, começando com #, em português>"
  )
}

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

function parseResponse(raw: string): { hook: string; caption: string; hashtags: string } {
  const hookMatch = raw.match(/GANCHO:\s*([\s\S]*?)(?:\nLEGENDA:|$)/i)
  const captionMatch = raw.match(/LEGENDA:\s*([\s\S]*?)(?:\nHASHTAGS:|$)/i)
  const hashtagsMatch = raw.match(/HASHTAGS:\s*([\s\S]*)/i)
  const hook = (hookMatch?.[1] ?? "").trim().replace(/["'.]+$/, "")
  const caption = (captionMatch?.[1] ?? "").trim()
  const hashtags = (hashtagsMatch?.[1] ?? "").trim()
  if (!hook) throw new Error("A IA não retornou gancho.")
  if (!caption) throw new Error("A IA não retornou legenda.")
  return { hook, caption, hashtags }
}

// Gera gancho + legenda + hashtags via Gemini. Reaproveita o mesmo
// cliente/config do compositor de letras (lib/composer/gemini.ts) — mesma
// conta, model/location configuráveis pelo admin.
export async function generateCaption(source: CaptionSource): Promise<CaptionResult> {
  const settings = await getComposerSettings()
  const userContent = buildUserContent(source)

  const raw = await generateLyrics({
    systemPrompt: buildSystemPrompt(),
    model: settings.model,
    location: settings.location,
    userContent,
  })

  const { hook, caption, hashtags } = parseResponse(raw)
  return { hook, caption, hashtags, promptUsed: userContent }
}
