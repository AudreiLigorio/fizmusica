// Publicador do Instagram — API de Content Publishing (fluxo "Instagram API
// with Instagram Login", endpoint graph.instagram.com).
//
// Fluxo de 2 passos exigido pela Meta:
//   1. cria um "container" de mídia (POST /{ig-user-id}/media) apontando pra
//      uma URL pública da imagem/vídeo + legenda;
//   2. publica o container (POST /{ig-user-id}/media_publish).
// Vídeo (Reels) é assíncrono: o container precisa terminar de processar
// (status_code FINISHED) antes do publish — por isso o polling.
//
// Credenciais (env): IG_LONG_LIVED_TOKEN (token de 60 dias, ver
// scripts/ig-token-check.sh). O id do usuário é resolvido via /me (fonte de
// verdade é o próprio token), com cache em memória por processo.
import sharp from "sharp"

const GRAPH = "https://graph.instagram.com"
const TOKEN = () => process.env.IG_LONG_LIVED_TOKEN ?? ""

type IgResult = { mediaId: string; permalink: string | null }

function requireToken() {
  const t = TOKEN()
  if (!t) throw new Error("IG_LONG_LIVED_TOKEN não configurado no ambiente.")
  return t
}

async function igGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set("access_token", requireToken())
  const res = await fetch(url.toString())
  const json = await res.json()
  if (!res.ok || json.error) {
    throw new Error(`IG API: ${json.error?.message ?? res.statusText}`)
  }
  return json
}

async function igPost(path: string, params: Record<string, string>) {
  const body = new URLSearchParams(params)
  body.set("access_token", requireToken())
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  const json = await res.json()
  if (!res.ok || json.error) {
    throw new Error(`IG API: ${json.error?.message ?? res.statusText}`)
  }
  return json
}

let cachedUserId: string | null = null
async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId
  const me = await igGet("me", { fields: "id,username" })
  cachedUserId = String(me.id)
  return cachedUserId
}

// Instagram só aceita imagem JPEG na Content Publishing API — nossa pipeline
// gera PNG (next/og). Convertemos e devolvemos os bytes JPEG.
async function toJpeg(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes).jpeg({ quality: 90 }).toBuffer()
}

// Sobe um buffer temporário como JPEG pública e devolve a URL. Reaproveita o
// bucket público content-media (já usado pelo resto da pipeline). O upload é
// feito pelo chamador (que tem o supabase client) — aqui só exigimos a URL.
export type IgImageInput = { imageUrl: string; caption: string }
export type IgVideoInput = { videoUrl: string; caption: string }

// Publica uma imagem. `imageUrl` deve ser uma URL pública já em JPEG (o
// chamador garante a conversão via ensureJpegPublicUrl abaixo).
export async function publishImage({ imageUrl, caption }: IgImageInput): Promise<IgResult> {
  const userId = await getUserId()
  const container = await igPost(`${userId}/media`, { image_url: imageUrl, caption })
  const creationId = String(container.id)

  // A Meta também PROCESSA container de imagem (baixa o arquivo da nossa URL,
  // valida formato e dimensões). Publicar antes disso devolve "Media ID is not
  // available" — erro que parece de permissão e é só pressa. Costuma levar 1 a
  // 3 segundos; esperamos até ~40s por segurança.
  await esperarContainer(creationId, 20, 2000)

  return finishPublish(userId, creationId)
}

// Aguarda o container ficar FINISHED. Vale pra imagem e pra vídeo — muda só a
// paciência: vídeo demora minutos, imagem demora segundos.
async function esperarContainer(creationId: string, tentativas: number, intervaloMs: number) {
  for (let i = 0; i < tentativas; i++) {
    const st = await igGet(`${creationId}`, { fields: "status_code" })
    if (st.status_code === "FINISHED") return
    if (st.status_code === "ERROR") throw new Error("IG: o processamento da mídia falhou.")
    await new Promise((r) => setTimeout(r, intervaloMs))
  }
  throw new Error("IG: tempo esgotado esperando a mídia ficar pronta para publicação.")
}

// Publica um vídeo como Reels (único tipo de vídeo aceito pela API hoje).
export async function publishReel({ videoUrl, caption }: IgVideoInput): Promise<IgResult> {
  const userId = await getUserId()
  const container = await igPost(`${userId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
  })
  const creationId = String(container.id)

  // Vídeo leva minutos: ~5 min de paciência (30 tentativas x 10s).
  await esperarContainer(creationId, 30, 10000)

  return finishPublish(userId, creationId)
}

async function finishPublish(userId: string, creationId: string): Promise<IgResult> {
  const published = await igPost(`${userId}/media_publish`, { creation_id: creationId })
  const mediaId = String(published.id)
  // permalink é best-effort — se falhar, publica mesmo assim, só sem o link.
  let permalink: string | null = null
  try {
    const info = await igGet(`${mediaId}`, { fields: "permalink" })
    permalink = info.permalink ?? null
  } catch {
    /* ignora — o post já está publicado */
  }
  return { mediaId, permalink }
}

// Converte PNG→JPEG e re-sobe como arquivo público, devolvendo a URL JPEG.
// Recebe o supabase client e o bucket do chamador pra não acoplar storage aqui.
export async function pngUrlToJpegBytes(pngUrl: string): Promise<Buffer> {
  const res = await fetch(pngUrl)
  if (!res.ok) throw new Error("Falha ao baixar a imagem para conversão JPEG.")
  const bytes = Buffer.from(await res.arrayBuffer())
  return toJpeg(bytes)
}
