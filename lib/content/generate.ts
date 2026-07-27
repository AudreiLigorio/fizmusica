import crypto from "crypto"
import type { createServerClient } from "@/lib/supabase"
import { gerarRoteiro, type RoteiroSource } from "@/lib/content/roteirista"
import { ensureDraftLink } from "@/lib/content/links"
import { generateImage, getImageTaskResult } from "@/lib/content/kie-image"
import { logContentEvent } from "@/lib/content/events"
import { logOrderEvent } from "@/lib/orderEvents"
import { composeBrandedImage } from "@/lib/content/brand-image"

type DB = ReturnType<typeof createServerClient>

const BUCKET = "content-media"

// Proporção que a KIE gera por plataforma. Só precisa cobrir bem o canvas final
// (que é definido em brand-image via object-fit cover), não bater exatamente.
function aspectFor(platform: string): "1:1" | "2:3" | "9:16" | "16:9" {
  if (platform === "tiktok") return "9:16"
  if (platform === "youtube") return "16:9"
  return "2:3" // instagram (cobre bem o 4:5 final)
}

// Mesmo bucket serve imagens (post estático) e, via scripts/video-worker,
// áudio bruto (mp3 do Suno) + o MP4 final — por isso os tipos/limite cobrem
// os três. 50MB é o teto aceito pelo plano do Supabase (100MB foi rejeitado).
async function ensureBucket(supabase: DB) {
  const { data } = await supabase.storage.getBucket(BUCKET)
  if (!data) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "audio/mpeg", "video/mp4"],
      fileSizeLimit: "50MB",
    })
  }
}

export type CreateDraftInput =
  | { platform: string; sourceType: "generico"; topic: string }
  | { platform: string; sourceType: "pedido"; sourceOrderId: string }

// Cria um rascunho: gera legenda via Gemini (síncrono), dispara a geração de
// imagem na KIE.ai (assíncrono — o taskId fica salvo pra sincronizar depois).
export async function createDraft(supabase: DB, input: CreateDraftInput) {
  let roteiroSource: RoteiroSource
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

    roteiroSource = {
      type: "pedido",
      musicName: music?.musicName?.trim() || music?.personName?.trim() || "música personalizada",
      subcategory: order.subcategory ?? "",
      lyricsExcerpt: order.lyricsDraft ?? "",
    }
    sourceOrderId = order.id
  } else {
    roteiroSource = { type: "generico", topic: input.topic }
  }

  // O roteirista já vem com a segunda passada (revisor crítico) embutida —
  // o que chega aqui ou passou no crivo, ou está marcado como needs_human.
  const { roteiro, parecer, precisaDeHumano } = await gerarRoteiro({
    formato: "post",
    platform: input.platform,
    source: roteiroSource,
  })

  const { data: draft, error } = await supabase
    .from("content_drafts")
    .insert({
      platform: input.platform,
      status: "rascunho",
      source_type: input.sourceType,
      sourceOrderId,
      topic: input.sourceType === "generico" ? input.topic : null,
      hook_text: roteiro.hook,
      caption: roteiro.caption,
      hashtags: roteiro.hashtags,
      prompt_used: roteiro.historia,
      roteiro,
      emocao_alvo: roteiro.emocao,
      persona: roteiro.persona,
      quality_report: parecer,
      quality_score: parecer.nota,
      needs_human: precisaDeHumano,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  await logContentEvent(supabase, draft.id, "rascunho_criado", `origem: ${input.sourceType}`)

  // Link rastreado do rascunho: é ele que vai pra bio/descrição, e é ele que
  // permite saber depois se esta peça trouxe visita. Falha aqui não derruba o
  // rascunho (ensureDraftLink já engole o erro e devolve null).
  const linkSlug = await ensureDraftLink(
    supabase,
    draft.id,
    input.platform,
    input.sourceType === "generico" ? input.topic : roteiroSource.type === "pedido" ? roteiroSource.subcategory : null,
  )
  if (linkSlug) draft.link_slug = linkSlug
  if (sourceOrderId) {
    await logOrderEvent(supabase, sourceOrderId, "conteudo_gerado", `plataforma: ${input.platform}`, "admin")
  }

  try {
    // A KIE gera SÓ o fundo visual — sem nenhum texto. O gancho, o logo e a marca
    // são compostos por nós depois (lib/content/brand-image), com fonte real e
    // precisão de pixel. Isso elimina o erro de ortografia na origem: a IA nunca
    // escreve texto, então nunca erra.
    // A cena vem do roteiro (história + emoção-alvo), não só do gancho solto —
    // é o que faz a imagem conversar com o texto em vez de ilustrar palavra.
    const imagePrompt =
      `Fotografia realista e calorosa para post de rede social. Pessoas brasileiras, expressões ` +
      `genuínas, luz natural — parece foto de verdade, não ilustração digital. ` +
      `Emoção a transmitir: ${roteiro.emocao}. Cena: ${roteiro.historia} ` +
      `Cores suaves, boa profundidade, espaço "respirável" na parte de baixo. ` +
      `NÃO escreva absolutamente nenhum texto, palavra, letra, número ou legenda na imagem — ` +
      `apenas a cena visual, sem tipografia de nenhum tipo.`
    const taskId = await generateImage({ prompt: imagePrompt, aspectRatio: aspectFor(input.platform) })
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
    .select("id, image_task_id, image_url, image_error, hook_text, platform")
    .eq("id", draftId)
    .maybeSingle()

  if (!draft) throw new Error("Rascunho não encontrado.")
  if (draft.image_url || draft.image_error) return draft
  if (!draft.image_task_id) throw new Error("Rascunho sem geração de imagem em andamento.")

  const result = await getImageTaskResult(draft.image_task_id)

  if (result.state === "success" && result.imageUrl) {
    await ensureBucket(supabase)
    const res = await fetch(result.imageUrl)
    const bgBytes = Buffer.from(await res.arrayBuffer())
    // Compõe a marca por cima do fundo (gancho + logo + faixa + handle/CTA).
    // Se a composição falhar por algum motivo, cai no fundo cru pra não travar.
    let finalBytes: Buffer = bgBytes
    try {
      finalBytes = await composeBrandedImage({
        backgroundBytes: bgBytes,
        hook: draft.hook_text ?? "",
        platform: draft.platform ?? "instagram",
      })
    } catch (e) {
      console.error("[content] composição da marca falhou, usando fundo cru:", e instanceof Error ? e.message : e)
    }
    const path = `${draftId}/${crypto.randomUUID()}.png`
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, finalBytes, { contentType: "image/png", upsert: false })
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
