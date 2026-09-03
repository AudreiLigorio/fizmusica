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
  /**
   * Deixa o modelo "pensar" antes de escrever.
   *
   * Medido em 2026-09-03, no mesmo pedido e no mesmo modelo:
   *   pensando  -> 1º trecho entre 8,6s e 48,4s; total de 9,7s a 74,4s
   *   sem pensar-> 1º trecho ~1s; total entre 2,9s e 4,3s
   *
   * O pensamento acontece ANTES de sair qualquer texto, então além de lento
   * ele deixa a tela parada. Pior: as rotas de letra têm maxDuration=60, e
   * duas das cinco medições passaram disso — a função morria no meio, o
   * stream quebrava e o cliente via "Não consegui gerar agora". Foi
   * exatamente o que aconteceu com o pedido c693957d.
   *
   * Escrever letra é geração criativa guiada por um prompt de 6.700
   * caracteres, não raciocínio em etapas — o pensamento cobra caro e entrega
   * pouco aqui. Por isso o padrão do STREAM (só letra pro cliente) é não
   * pensar. Os agentes de conteúdo, que fazem tarefa de planejamento, seguem
   * pensando: não mexi neles sem evidência de que melhora ou piora.
   */
  pensar?: boolean
}

// `thinkingBudget: 0` desliga; ausente = o padrão do modelo (ligado).
function configDePensamento(pensar: boolean | undefined) {
  return pensar ? {} : { thinkingConfig: { thinkingBudget: 0 } }
}

// Gera a letra completa (sem streaming).
export async function generateLyrics(opts: LyricsOpts): Promise<string> {
  const ai = getClient(opts.location)

  const res = await ai.models.generateContent({
    model: opts.model,
    contents: opts.userContent,
    config: {
      // Padrão TRUE aqui: esta versão é a que os agentes de conteúdo usam, e
      // eles fazem planejamento. Quem quer velocidade pede `pensar: false`.
      ...configDePensamento(opts.pensar ?? true),
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
      // Padrão FALSE: os dois únicos consumidores do stream são as rotas de
      // letra do cliente, que esperam na tela e morrem em 60s.
      ...configDePensamento(opts.pensar ?? false),
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
