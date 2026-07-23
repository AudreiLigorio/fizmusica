import crypto from "crypto"
import type { createServerClient } from "@/lib/supabase"
import { generateCaption, type CaptionSource } from "@/lib/content/caption"
import { generateImage, getImageTaskResult } from "@/lib/content/kie-image"
import { logContentEvent } from "@/lib/content/events"
import { logOrderEvent } from "@/lib/orderEvents"

type DB = ReturnType<typeof createServerClient>

const BUCKET = "content-media"

async function ensureBucket(supabase: DB) {
  const { data } = await supabase.storage.getBucket(BUCKET)
  if (!data) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      fileSizeLimit: "8MB",
    })
  }
}

export type CreateDraftInput =
  | { platform: string; sourceType: "generico"; topic: string }
  | { platform: string; sourceType: "pedido"; sourceOrderId: string }

// Cria um rascunho: gera legenda via Gemini (síncrono), dispara a geração de
// imagem na KIE.ai (assíncrono — o taskId fica salvo pra sincronizar depois).
export async function createDraft(supabase: DB, input: CreateDraftInput) {
  let captionSource: CaptionSource
  let sourceOrderId: string | null = null

  if (input.sourceType === "pedido") {
    const { data: order } = await supabase
      .from("orders")
      .select("id, subcategory, publication_consent, lyricsDraft")
      .eq("id", input.sourceOrderId)
      .maybeSingle()
    if (!order) throw new Error("Pedido não encontrado.")
    if (!order.publication_consent) throw new Error("Este pedido não tem consentimento de publicação.")

    const { data: music } = await supabase
      .from("generated_music")
      .select("musicName, personName")
      .eq("orderId", input.sourceOrderId)
      .maybeSingle()

    captionSource = {
      type: "pedido",
      platform: input.platform,
      musicName: music?.musicName?.trim() || music?.personName?.trim() || "música personalizada",
      subcategory: order.subcategory ?? "",
      lyricsExcerpt: order.lyricsDraft ?? "",
    }
    sourceOrderId = order.id
  } else {
    captionSource = { type: "generico", platform: input.platform, topic: input.topic }
  }

  const { caption, hashtags, promptUsed } = await generateCaption(captionSource)

  const { data: draft, error } = await supabase
    .from("content_drafts")
    .insert({
      platform: input.platform,
      status: "rascunho",
      source_type: input.sourceType,
      sourceOrderId,
      topic: input.sourceType === "generico" ? input.topic : null,
      caption,
      hashtags,
      prompt_used: promptUsed,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  await logContentEvent(supabase, draft.id, "rascunho_criado", `origem: ${input.sourceType}`)
  if (sourceOrderId) {
    await logOrderEvent(supabase, sourceOrderId, "conteudo_gerado", `plataforma: ${input.platform}`, "admin")
  }

  try {
    const taskId = await generateImage({ prompt: `${caption}\n\nEstilo: fotografia calorosa, cores suaves.` })
    await supabase.from("content_drafts").update({ image_task_id: taskId }).eq("id", draft.id)
    draft.image_task_id = taskId
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao iniciar geração de imagem."
    await supabase.from("content_drafts").update({ image_error: msg }).eq("id", draft.id)
    await logContentEvent(supabase, draft.id, "imagem_falhou", msg)
    draft.image_error = msg
  }

  return draft
}

// Consulta o estado da geração de imagem (polling, chamado pela tela de
// qualificação enquanto o rascunho não tem image_url nem image_error).
export async function syncImageTask(supabase: DB, draftId: string) {
  const { data: draft } = await supabase
    .from("content_drafts")
    .select("id, image_task_id, image_url, image_error")
    .eq("id", draftId)
    .maybeSingle()

  if (!draft) throw new Error("Rascunho não encontrado.")
  if (draft.image_url || draft.image_error) return draft
  if (!draft.image_task_id) throw new Error("Rascunho sem geração de imagem em andamento.")

  const result = await getImageTaskResult(draft.image_task_id)

  if (result.state === "success" && result.imageUrl) {
    await ensureBucket(supabase)
    const res = await fetch(result.imageUrl)
    const bytes = Buffer.from(await res.arrayBuffer())
    const path = `${draftId}/${crypto.randomUUID()}.png`
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: false })
    if (uploadErr) throw new Error("Falha ao salvar a imagem gerada.")

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    await supabase.from("content_drafts").update({ image_url: publicUrl }).eq("id", draftId)
    await logContentEvent(supabase, draftId, "imagem_gerada")
    return { ...draft, image_url: publicUrl }
  }

  if (result.state === "fail") {
    const msg = result.failMsg ?? "Falha na geração de imagem."
    await supabase.from("content_drafts").update({ image_error: msg }).eq("id", draftId)
    await logContentEvent(supabase, draftId, "imagem_falhou", msg)
    return { ...draft, image_error: msg }
  }

  return draft // ainda gerando (waiting/queuing/generating)
}
