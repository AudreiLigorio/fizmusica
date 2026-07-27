import crypto from "crypto"
import type { createServerClient } from "@/lib/supabase"
import { logContentEvent } from "@/lib/content/events"
import { garantirMidiaPropria } from "@/lib/content/guardas"
import { publishImage, publishReel, pngUrlToJpegBytes } from "@/lib/content/publishers/instagram"

type DB = ReturnType<typeof createServerClient>

const BUCKET = "content-media"

// Publica um rascunho já APROVADO na rede correspondente. Hoje só Instagram
// tem integração real (Meta aprovada + token de 60 dias); TikTok/YouTube ainda
// dependem de aprovação da plataforma — por isso o switch explícito.
export async function publishDraft(supabase: DB, draftId: string) {
  const { data: draft } = await supabase
    .from("content_drafts")
    .select("id, platform, status, caption, hashtags, image_url, video_url, published_at, sourceOrderId")
    .eq("id", draftId)
    .maybeSingle()

  if (!draft) throw new Error("Rascunho não encontrado.")
  if (draft.status !== "aprovado") throw new Error("Só é possível publicar um rascunho aprovado.")
  if (draft.published_at) throw new Error("Este rascunho já foi publicado.")

  if (draft.platform !== "instagram") {
    throw new Error(
      `Publicação automática ainda não disponível para ${draft.platform}. ` +
      `Só o Instagram tem integração ativa por enquanto.`
    )
  }

  // Peça feita a partir da história de um cliente real: o consentimento é
  // conferido AQUI, no instante da publicação, e não no da criação. O cliente
  // pode ter revogado a Autorização de Publicação nesse meio-tempo, e o aviso
  // na tela não impede uma chamada direta à API. Barrar é a única garantia.
  if (draft.sourceOrderId) {
    const { data: order } = await supabase
      .from("orders")
      .select("publication_consent")
      .eq("id", draft.sourceOrderId)
      .maybeSingle()
    if (!order?.publication_consent) {
      throw new Error(
        "O cliente não autoriza (ou revogou) a publicação desta história. " +
        "Esta peça não pode ir ao ar."
      )
    }
  }

  // Última barreira antes do conteúdo virar público.
  garantirMidiaPropria([draft.image_url, draft.video_url], "Publicação bloqueada")

  const caption = [draft.caption?.trim(), draft.hashtags?.trim()].filter(Boolean).join("\n\n")

  try {
    let result: { mediaId: string; permalink: string | null }

    if (draft.video_url) {
      // Vídeo vira Reels — a URL do MP4 no bucket já é pública.
      result = await publishReel({ videoUrl: draft.video_url, caption })
    } else if (draft.image_url) {
      // Desde a higiene de storage o rascunho já nasce em JPEG — o formato que
      // o IG exige — então publica direto, sem segunda cópia no bucket. Só os
      // rascunhos antigos (PNG) ainda passam pela conversão.
      let imageUrl = draft.image_url
      if (!/\.jpe?g($|\?)/i.test(imageUrl)) {
        const jpegBytes = await pngUrlToJpegBytes(draft.image_url)
        const path = `${draftId}/${crypto.randomUUID()}.jpg`
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, jpegBytes, { contentType: "image/jpeg", upsert: false })
        if (upErr) throw new Error("Falha ao preparar a imagem JPEG para publicação.")
        imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      }
      result = await publishImage({ imageUrl, caption })
    } else {
      throw new Error("Rascunho sem imagem nem vídeo para publicar.")
    }

    await supabase
      .from("content_drafts")
      .update({
        published_at: new Date().toISOString(),
        published_platform_id: result.mediaId,
        published_permalink: result.permalink,
        publish_error: null,
      })
      .eq("id", draftId)
    await logContentEvent(supabase, draftId, "publicado", `instagram media ${result.mediaId}`, "admin")

    return { mediaId: result.mediaId, permalink: result.permalink }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao publicar."
    await supabase.from("content_drafts").update({ publish_error: msg }).eq("id", draftId)
    await logContentEvent(supabase, draftId, "publicacao_falhou", msg, "admin")
    throw new Error(msg)
  }
}
