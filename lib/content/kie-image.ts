// Cliente de geração de imagem via KIE.ai (mesma conta usada pro Suno em lib/suno/client.ts).
// Docs: https://docs.kie.ai/ — API genérica de jobs (createTask/recordInfo), usada por
// vários modelos de imagem do catálogo (Nano Banana / Gemini Flash Image, Flux, etc).
// Auth via Bearer KIE_API_KEY. Geração é assíncrona — aqui só disparamos e recebemos o
// taskId; o resultado é consultado via recordInfo (polling), mesmo padrão do Suno.
//
// IMPORTANTE: o identificador exato do "model" abaixo (KIE_IMAGE_MODEL) precisa ser
// conferido em https://kie.ai/market antes do primeiro uso real — os nomes de modelo
// do catálogo da KIE podem mudar; ajuste a env var se o valor abaixo não funcionar.

const KIE_BASE = "https://api.kie.ai/api/v1"
const DEFAULT_MODEL = process.env.KIE_IMAGE_MODEL || "google/nano-banana"

export type ImageGenerateParams = {
  prompt: string
  aspectRatio?: "1:1" | "3:2" | "2:3" | "9:16" | "16:9"
  callBackUrl?: string
}

export type ImageTaskState = "waiting" | "queuing" | "generating" | "success" | "fail"

export type ImageTaskResult = {
  state: ImageTaskState
  imageUrl: string | null
  failMsg: string | null
}

function apiKey(): string {
  const k = process.env.KIE_API_KEY
  if (!k) throw new Error("KIE_API_KEY não configurada.")
  return k
}

// Dispara a geração de imagem. Retorna o taskId para consultar via recordInfo.
export async function generateImage(params: ImageGenerateParams): Promise<string> {
  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: {
        prompt: params.prompt,
        aspect_ratio: params.aspectRatio ?? "1:1",
      },
      callBackUrl: params.callBackUrl,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.code !== 200) {
    throw new Error(data?.msg || `Falha ao gerar imagem (HTTP ${res.status}).`)
  }
  const taskId = data?.data?.taskId
  if (!taskId) throw new Error("KIE.ai não retornou taskId.")
  return taskId
}

// Estado/resultado de uma task de imagem (polling, fallback caso o webhook falhe).
export async function getImageTaskResult(taskId: string): Promise<ImageTaskResult> {
  const res = await fetch(`${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  })
  const data = await res.json().catch(() => ({}))
  const state: ImageTaskState = data?.data?.state ?? "fail"
  const resultJson = data?.data?.resultJson
  const parsed = typeof resultJson === "string" ? JSON.parse(resultJson || "{}") : (resultJson ?? {})
  const imageUrl: string | null = parsed?.resultUrls?.[0] ?? parsed?.result_urls?.[0] ?? null

  return {
    state,
    imageUrl: state === "success" ? imageUrl : null,
    failMsg: state === "fail" ? (data?.data?.failMsg ?? "Falha na geração de imagem.") : null,
  }
}
