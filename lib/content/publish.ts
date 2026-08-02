import crypto from "crypto"
import type { createServerClient } from "@/lib/supabase"
import { logContentEvent } from "@/lib/content/events"
import { garantirMidiaPropria } from "@/lib/content/guardas"
import { purgeVideoIngredients } from "@/lib/content/media"
import { publishImage, publishReel, pngUrlToJpegBytes } from "@/lib/content/publishers/instagram"
import { publishVideoTikTok, type OpcoesPost } from "@/lib/content/publishers/tiktok"

type DB = ReturnType<typeof createServerClient>

const BUCKET = "content-media"


// Descarte de ingredientes só quando a HISTÓRIA inteira terminou.
//
// Publicar no Instagram não pode destruir o material da versão do TikTok: as
// peças-irmãs reaproveitam as mesmas cenas, voz e trilha, e remontar com a
// marca da outra rede é de graça. A regra anterior ("publicou, apagou") valia
// quando cada peça era ilha — com adaptação entre redes, ela apagava o insumo
// de quem ainda nem foi ao ar.
async function descartarIngredientesSeFamiliaCompleta(supabase: DB, draftId: string) {
  try {
    const { data: eu } = await supabase
      .from("content_drafts").select("id, derivado_de").eq("id", draftId).maybeSingle()
    const raiz = eu?.derivado_de ?? draftId

    const { data: familia } = await supabase
      .from("content_drafts")
      .select("id, published_at")
      .or(`id.eq.${raiz},derivado_de.eq.${raiz}`)

    const faltaAlguem = (familia ?? []).some((p) => p.id !== draftId && !p.published_at)
    if (faltaAlguem) return

    const ids = (familia ?? []).map((p) => p.id)
    const { data: jobs } = await supabase.from("video_jobs").select("id").in("contentDraftId", ids)
    for (const j of jobs ?? []) await purgeVideoIngredients(supabase, j.id)
  } catch (e) {
    console.error("[publish] ingredientes não descartados:", e instanceof Error ? e.message : e)
  }
}

/**
 * Registra publicação feita À MÃO (TikTok e YouTube, que ainda não têm API de
 * postagem aqui). Sem isso a peça ficaria eternamente "aprovada": o painel
 * mentiria sobre onde a história já está, as métricas não teriam âncora e os
 * ingredientes de vídeo nunca seriam descartados — porque o descarte espera a
 * família inteira ir ao ar.
 */
export async function marcarComoPublicado(supabase: DB, draftId: string, permalink?: string) {
  const { data: draft } = await supabase
    .from("content_drafts").select("id, platform, status, published_at").eq("id", draftId).maybeSingle()
  if (!draft) throw new Error("Rascunho não encontrado.")
  if (draft.published_at) throw new Error("Este rascunho já está marcado como publicado.")
  if (draft.status !== "aprovado") throw new Error("Só peça aprovada pode ser marcada como publicada.")
  if (draft.platform === "instagram") {
    throw new Error("O Instagram publica pelo botão — marcar à mão esconderia uma falha real.")
  }

  await supabase
    .from("content_drafts")
    .update({
      published_at: new Date().toISOString(),
      published_permalink: permalink?.trim() || null,
      publish_error: null,
    })
    .eq("id", draftId)
  await logContentEvent(supabase, draftId, "publicado", `${draft.platform} publicado manualmente`, "admin")

  await descartarIngredientesSeFamiliaCompleta(supabase, draftId)
  return { permalink: permalink?.trim() || null }
}

// Publica um rascunho já APROVADO na rede correspondente. Hoje só Instagram
// tem integração real (Meta aprovada + token de 60 dias); TikTok/YouTube ainda
// dependem de aprovação da plataforma — por isso o switch explícito.
export async function publishDraft(supabase: DB, draftId: string, opcoesTiktok?: OpcoesPost) {
  const { data: draft } = await supabase
    .from("content_drafts")
    .select("id, platform, status, caption, hashtags, image_url, video_url, published_at, sourceOrderId")
    .eq("id", draftId)
    .maybeSingle()

  if (!draft) throw new Error("Rascunho não encontrado.")
  if (draft.status !== "aprovado") throw new Error("Só é possível publicar um rascunho aprovado.")
  if (draft.published_at) throw new Error("Este rascunho já foi publicado.")

  if (draft.platform === "tiktok" && !draft.video_url) {
    // Foto no TikTok só entra por PULL_FROM_URL, que exige domínio verificado
    // no portal — o arquivo mora no supabase.co. Peça sem vídeo vai à mão.
    throw new Error(
      "No TikTok a publicação automática só funciona com vídeo (foto exige domínio verificado). " +
      "Gere o vídeo desta peça ou poste a imagem à mão."
    )
  }
  if (draft.platform !== "instagram" && draft.platform !== "tiktok") {
    throw new Error(
      `Publicação automática ainda não disponível para ${draft.platform}. ` +
      `Instagram e TikTok têm integração ativa; o YouTube depende do OAuth do Google.`
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
    let result: { mediaId: string; permalink: string | null; nota?: string }

    if (draft.platform === "tiktok") {
      // As escolhas vêm da tela de publicação (privacidade, interações,
      // divulgação comercial e título editável). São obrigatórias: as
      // diretrizes de UX do TikTok proíbem publicar com padrão implícito.
      if (!opcoesTiktok?.privacyLevel) {
        throw new Error("Faltou escolher a privacidade do post no TikTok.")
      }
      const r = await publishVideoTikTok({ videoUrl: draft.video_url!, opcoes: opcoesTiktok })
      result = {
        mediaId: r.publishId,
        permalink: r.permalink,
        nota:
          r.status === "PUBLISH_COMPLETE"
            ? `privacidade ${r.privacidade}`
            : `ainda em processamento no TikTok (${r.status}) — o post aparece sozinho quando a moderação terminar`,
      }
    } else if (draft.video_url) {
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

    await descartarIngredientesSeFamiliaCompleta(supabase, draftId)

    await supabase
      .from("content_drafts")
      .update({
        published_at: new Date().toISOString(),
        published_platform_id: result.mediaId,
        published_permalink: result.permalink,
        publish_error: null,
      })
      .eq("id", draftId)
    await logContentEvent(
      supabase, draftId, "publicado",
      `${draft.platform} ${result.mediaId}${result.nota ? ` — ${result.nota}` : ""}`, "admin",
    )

    return { mediaId: result.mediaId, permalink: result.permalink, nota: result.nota ?? null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao publicar."
    await supabase.from("content_drafts").update({ publish_error: msg }).eq("id", draftId)
    await logContentEvent(supabase, draftId, "publicacao_falhou", msg, "admin")
    throw new Error(msg)
  }
}
