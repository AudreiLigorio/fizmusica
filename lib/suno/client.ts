// Cliente da API de música do KIE.ai (Suno).
// Docs: https://docs.kie.ai/suno-api/generate-music
// Auth via Bearer KIE_API_KEY. Geração é assíncrona — o resultado chega no webhook
// (callBackUrl). Aqui só disparamos e recebemos o taskId.

const KIE_BASE = "https://api.kie.ai/api/v1"

export type SunoGenerateParams = {
  prompt: string        // letra (customMode) ou descrição
  style: string         // gênero/mood (obrigatório em customMode)
  title: string         // título (obrigatório em customMode)
  vocalGender?: "m" | "f"
  model?: string        // V4, V4_5, V4_5PLUS, V5, V5_5
  callBackUrl: string
  instrumental?: boolean
}

export type SunoTrack = {
  audioId: string
  audioUrl: string
  imageUrl: string | null
  title: string | null
  duration: number | null
}

function apiKey(): string {
  const k = process.env.KIE_API_KEY
  if (!k) throw new Error("KIE_API_KEY não configurada.")
  return k
}

// Dispara a geração. Retorna o taskId para rastrear via webhook.
export async function generateMusic(params: SunoGenerateParams): Promise<string> {
  const res = await fetch(`${KIE_BASE}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      style: params.style,
      title: params.title,
      customMode: true,
      instrumental: params.instrumental ?? false,
      model: params.model ?? "V5",
      vocalGender: params.vocalGender,
      callBackUrl: params.callBackUrl,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.code !== 200) {
    throw new Error(data?.msg || `Falha ao gerar música (HTTP ${res.status}).`)
  }
  const taskId = data?.data?.taskId
  if (!taskId) throw new Error("Suno não retornou taskId.")
  return taskId
}

// Detalhes/estado de uma task de geração (fallback caso o webhook falhe).
export async function getMusicDetails(taskId: string): Promise<any> {
  const res = await fetch(`${KIE_BASE}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  })
  return res.json()
}

// Saldo de créditos restantes na conta KIE.ai.
export async function getCreditBalance(): Promise<number> {
  const res = await fetch(`${KIE_BASE}/chat/credit`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.code !== 200) {
    throw new Error(data?.msg || `Falha ao consultar créditos (HTTP ${res.status}).`)
  }
  return Number(data.data)
}

// Letra sincronizada (timestamps por palavra). Usado na Fase 3 (LRC automático).
export async function getTimestampedLyrics(taskId: string, audioId: string): Promise<unknown> {
  const res = await fetch(`${KIE_BASE}/generate/get-timestamped-lyrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({ taskId, audioId }),
  })
  return res.json()
}
