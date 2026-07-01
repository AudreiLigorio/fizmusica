import { GoogleGenAI } from "@google/genai"

// Cliente do Gemini. Dois modos de autenticação (recriado por chamada — barato
// e evita estado preso entre invocações serverless):
//  1) GEMINI_API_KEY  → API do Gemini (AI Studio). Mais simples, sem service account.
//  2) GCP_SERVICE_ACCOUNT_JSON + GCP_PROJECT_ID → Vertex AI.
function getClient(location: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (apiKey) return new GoogleGenAI({ apiKey })

  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error("Configure GEMINI_API_KEY (AI Studio) ou GCP_SERVICE_ACCOUNT_JSON (Vertex).")
  if (!process.env.GCP_PROJECT_ID) throw new Error("GCP_PROJECT_ID não configurado.")

  let credentials: Record<string, unknown>
  try {
    credentials = JSON.parse(raw)
  } catch {
    throw new Error("GCP_SERVICE_ACCOUNT_JSON inválido (não é JSON).")
  }

  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID,
    location,
    googleAuthOptions: { credentials },
  })
}

type LyricsOpts = {
  systemPrompt: string
  model: string
  location: string
  userContent: string
}

// Gera a letra completa (sem streaming).
export async function generateLyrics(opts: LyricsOpts): Promise<string> {
  const ai = getClient(opts.location)

  const res = await ai.models.generateContent({
    model: opts.model,
    contents: opts.userContent,
    config: {
      systemInstruction: opts.systemPrompt,
      temperature: 0.9,
    },
  })

  const text = (res.text ?? "").trim()
  if (!text) throw new Error("A IA não retornou letra.")
  return text
}

// Gera a letra em streaming (AsyncIterable de chunks de texto).
export async function generateLyricsStream(opts: LyricsOpts): Promise<AsyncIterable<string>> {
  const ai = getClient(opts.location)

  const stream = await ai.models.generateContentStream({
    model: opts.model,
    contents: opts.userContent,
    config: {
      systemInstruction: opts.systemPrompt,
      temperature: 0.9,
    },
  })

  return (async function* () {
    for await (const chunk of stream) {
      const text = chunk.text ?? ""
      if (text) yield text
    }
  })()
}
