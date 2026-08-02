// Content Posting API do TikTok — publicação direta (Direct Post).
//
// Fluxo obrigatório, na ordem que a doc exige:
//   1. creator_info/query  → quem é a conta e QUAIS privacidades ela aceita
//   2. video/init          → abre o envio e devolve publish_id + upload_url
//   3. PUT no upload_url   → os bytes do MP4, em pedaço único (nossos vídeos
//                            são pequenos; o mínimo por chunk é 5 MB)
//   4. status/fetch        → espera sair de PROCESSING_UPLOAD
//
// Duas limitações que valem mais que o código e não dá pra contornar aqui:
//
// • Enquanto o app não passar pela AUDITORIA do TikTok, tudo que ele publica
//   fica em modo privado, mesmo pedindo PUBLIC_TO_EVERYONE. A aprovação do
//   escopo `video.publish` libera o envio; a auditoria é que libera o público.
// • Foto só entra por PULL_FROM_URL, que exige verificar a posse do domínio no
//   portal — o arquivo mora no supabase.co, domínio que não é nosso. Então
//   peça de TikTok sem vídeo continua sendo postada à mão.
//
// Docs: https://developers.tiktok.com/doc/content-posting-api-get-started
//       https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide
import { getValidAccessToken, getConnectionStatus } from "./tiktok-auth"

const API = "https://open.tiktokapis.com/v2"

// Ordem de preferência: queremos o post mais público que a conta permitir.
const PRIVACIDADE_PREFERIDA = [
  "PUBLIC_TO_EVERYONE",
  "FOLLOWER_OF_CREATOR",
  "MUTUAL_FOLLOW_FRIENDS",
  "SELF_ONLY",
]

const TITULO_MAX = 2200 // runas UTF-16, limite da API

type CreatorInfo = {
  creator_username: string
  privacy_level_options: string[]
  max_video_post_duration_sec: number
  comment_disabled: boolean
}

async function chamar<T>(caminho: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${caminho}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as { data?: T; error?: { code: string; message: string } }
  if (json.error && json.error.code !== "ok") {
    throw new Error(`TikTok (${json.error.code}): ${json.error.message}`)
  }
  if (!res.ok) throw new Error(`TikTok respondeu ${res.status} em ${caminho}`)
  return json.data as T
}

/** A conta conectada tem escopo de publicação? Sem isso o botão é ilusão. */
export async function podePublicar(): Promise<{ ok: boolean; motivo?: string }> {
  const status = await getConnectionStatus()
  if (!status.connected) {
    return { ok: false, motivo: "TikTok não está conectado — conecte pelo Login Kit no painel." }
  }
  if (!status.scope?.includes("video.publish")) {
    return {
      ok: false,
      motivo:
        "A conta está conectada só para login (user.info.basic). Depois que a Content Posting API " +
        "for aprovada, ligue TIKTOK_PUBLISH_SCOPE=1 e reconecte a conta para autorizar video.publish.",
    }
  }
  return { ok: true }
}

export async function queryCreatorInfo(): Promise<CreatorInfo> {
  const token = await getValidAccessToken()
  return chamar<CreatorInfo>("/post/publish/creator_info/query/", token, {})
}

type StatusPost = {
  status: string
  fail_reason?: string
  publicaly_available_post_id?: string[]
}

export type ResultadoTiktok = {
  publishId: string
  permalink: string | null
  privacidade: string
  status: string
}

/**
 * Publica um MP4 na conta conectada.
 *
 * `caption` já vem com legenda + hashtags coladas — no TikTok o texto do post é
 * o `title`, e hashtag dentro dele funciona normalmente.
 */
export async function publishVideoTikTok({
  videoUrl,
  caption,
  isAigc = true,
}: {
  videoUrl: string
  caption: string
  isAigc?: boolean
}): Promise<ResultadoTiktok> {
  const permissao = await podePublicar()
  if (!permissao.ok) throw new Error(permissao.motivo!)

  const token = await getValidAccessToken()

  // 1. A doc exige consultar o criador ANTES de postar: é daqui que sai a lista
  //    de privacidades válidas pra esta conta (uma conta privada não aceita
  //    PUBLIC_TO_EVERYONE, e mandar assim é erro).
  const creator = await queryCreatorInfo()
  const privacidade =
    PRIVACIDADE_PREFERIDA.find((p) => creator.privacy_level_options?.includes(p)) ?? "SELF_ONLY"

  // 2. Baixa o MP4 do nosso bucket. Não dá pra mandar a URL (PULL_FROM_URL só
  //    aceita domínio verificado no portal, e o arquivo mora no supabase.co).
  const res = await fetch(videoUrl)
  if (!res.ok) throw new Error("Não consegui baixar o vídeo do storage para enviar ao TikTok.")
  const bytes = Buffer.from(await res.arrayBuffer())
  if (!bytes.length) throw new Error("O vídeo está vazio.")

  // Pedaço único: o mínimo por chunk é 5 MB e o máximo 64 MB. Vídeo nosso é bem
  // menor que isso; se um dia passar de 64 MB, aí sim vale fatiar.
  if (bytes.length > 64 * 1024 * 1024) {
    throw new Error("Vídeo acima de 64 MB — o envio em pedaço único não serve; precisa fatiar em chunks.")
  }

  const init = await chamar<{ publish_id: string; upload_url: string }>(
    "/post/publish/video/init/",
    token,
    {
      post_info: {
        title: caption.slice(0, TITULO_MAX),
        privacy_level: privacidade,
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
        // Cenas geradas por IA e voz sintética: declarar é exigência da
        // plataforma e a verdade sobre como a peça foi feita.
        is_aigc: isAigc,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: bytes.length,
        chunk_size: bytes.length,
        total_chunk_count: 1,
      },
    },
  )

  // 3. Os bytes. O upload_url vale 1 hora.
  const up = await fetch(init.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(bytes.length),
      "Content-Range": `bytes 0-${bytes.length - 1}/${bytes.length}`,
    },
    body: new Uint8Array(bytes),
  })
  if (!up.ok) {
    throw new Error(`Falha ao enviar o vídeo ao TikTok (HTTP ${up.status}).`)
  }

  // 4. Espera o processamento. A moderação costuma levar menos de um minuto,
  //    mas pode demorar horas — então não travamos aqui: se ainda estiver
  //    processando, devolvemos o publish_id e o post aparece sozinho.
  let status: StatusPost = { status: "PROCESSING_UPLOAD" }
  const limite = Date.now() + 90_000
  while (Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 5000))
    status = await chamar<StatusPost>("/post/publish/status/fetch/", token, { publish_id: init.publish_id })
    if (status.status === "PUBLISH_COMPLETE" || status.status === "FAILED") break
  }

  if (status.status === "FAILED") {
    throw new Error(`TikTok recusou o vídeo: ${status.fail_reason ?? "motivo não informado"}`)
  }

  const postId = status.publicaly_available_post_id?.[0]
  const permalink = postId ? `https://www.tiktok.com/@${creator.creator_username}/video/${postId}` : null

  return { publishId: init.publish_id, permalink, privacidade, status: status.status }
}
