import crypto from "crypto"
import type { createServerClient } from "@/lib/supabase"
import { gerarRoteiro, type RoteiroSource } from "@/lib/content/roteirista"
import { ensureDraftLink } from "@/lib/content/links"
import { generateImage, getImageTaskResult } from "@/lib/content/kie-image"
import { logContentEvent } from "@/lib/content/events"
import { logOrderEvent } from "@/lib/orderEvents"
import { composeBrandedImage } from "@/lib/content/brand-image"
import sharp from "sharp"

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
      // A lista é branca: MIME fora dela é RECUSADO no upload, com uma
      // mensagem que não diz qual bucket nem qual regra. Já custou duas
      // rodadas de depuração (áudio do Suno em 23/07, narração WAV em 29/07)
      // — quando um formato novo entrar na pipeline, ele precisa entrar aqui
      // E no bucket que já existe (criar não atualiza o que está criado).
      allowedMimeTypes: [
        "image/jpeg", "image/png", "image/webp",
        "audio/mpeg", "audio/wav", "audio/x-wav", "audio/wave",
        "video/mp4",
      ],
      fileSizeLimit: "50MB",
    })
  }
}

export type CreateDraftInput =
  | { platform: string; sourceType: "generico"; topic: string; derivadoDe?: string }
  | { platform: string; sourceType: "pedido"; sourceOrderId: string; derivadoDe?: string }

// Cria um rascunho: gera legenda via Gemini (síncrono), dispara a geração de
// imagem na KIE.ai (assíncrono — o taskId fica salvo pra sincronizar depois).
// Cria a LINHA primeiro, gera depois. Assim o trabalho existe desde o
// primeiro segundo: se o admin sair da tela, se a conexão cair ou se a função
// morrer no meio, o rascunho está lá — em 'gerando' ou em 'falhou' com o
// motivo, nunca em silêncio. Antes disso a linha só nascia no fim, e um
// timeout apagava tudo sem deixar rastro.
export async function createDraft(supabase: DB, input: CreateDraftInput) {
  const { data: draft, error: insertError } = await supabase
    .from("content_drafts")
    .insert({
      platform: input.platform,
      status: "gerando",
      source_type: input.sourceType,
      sourceOrderId: input.sourceType === "pedido" ? input.sourceOrderId : null,
      topic: input.sourceType === "generico" ? input.topic : null,
      derivado_de: input.derivadoDe ?? null,
    })
    .select("*")
    .single()
  if (insertError) throw new Error(insertError.message)

  await logContentEvent(supabase, draft.id, "rascunho_criado", `origem: ${input.sourceType}`)

  try {
    return await runGeneration(supabase, draft.id)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao gerar o rascunho."
    await supabase
      .from("content_drafts")
      .update({ status: "falhou", generation_error: msg })
      .eq("id", draft.id)
    await logContentEvent(supabase, draft.id, "imagem_falhou", msg)
    return { ...draft, status: "falhou", generation_error: msg }
  }
}

// Roda (ou re-roda) a geração de um rascunho já existente: roteirista +
// imagem + link rastreado. Chamado na criação e no botão "tentar de novo".
export async function runGeneration(supabase: DB, draftId: string) {
  const { data: existing } = await supabase
    .from("content_drafts")
    .select("id, platform, source_type, sourceOrderId, topic, derivado_de")
    .eq("id", draftId)
    .maybeSingle()
  if (!existing) throw new Error("Rascunho não encontrado.")

  const input: CreateDraftInput =
    existing.source_type === "pedido"
      ? { platform: existing.platform, sourceType: "pedido", sourceOrderId: existing.sourceOrderId, derivadoDe: existing.derivado_de ?? undefined }
      : { platform: existing.platform, sourceType: "generico", topic: existing.topic ?? "", derivadoDe: existing.derivado_de ?? undefined }

  await supabase
    .from("content_drafts")
    .update({ status: "gerando", generation_error: null })
    .eq("id", draftId)

  return fillDraft(supabase, draftId, input)
}

async function fillDraft(supabase: DB, draftId: string, input: CreateDraftInput) {
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
  // Adaptação de rede: busca a peça original pra manter emoção, persona e
  // história, mudando só o que a rede de destino exige.
  let adaptarDe
  if (input.derivadoDe) {
    const { data: origem } = await supabase
      .from("content_drafts")
      .select("platform, hook_text, persona, emocao_alvo, roteiro")
      .eq("id", input.derivadoDe)
      .maybeSingle()
    if (origem?.roteiro) {
      adaptarDe = {
        historia: (origem.roteiro as { historia?: string }).historia ?? "",
        persona: origem.persona ?? "",
        emocao: origem.emocao_alvo ?? "",
        hook: origem.hook_text ?? "",
        plataformaOriginal: origem.platform,
      }
    }
  }

  const { roteiro, parecer, precisaDeHumano } = await gerarRoteiro({
    formato: "post",
    platform: input.platform,
    source: roteiroSource,
    adaptarDe,
  })

  const { data: draft, error } = await supabase
    .from("content_drafts")
    .update({
      status: "rascunho",
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
    .eq("id", draftId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)

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
    .select("id, image_task_id, image_url, image_error, hook_text, platform, status, published_at")
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
    // Guarda em JPEG, não PNG. A peça é uma foto com texto sobreposto: o PNG
    // sem perda custava ~2,3 MB por imagem (≈430 imagens até estourar 1 GB) e
    // o JPEG de qualidade 90 é visualmente idêntico por uma fração disso.
    // Bônus: é o formato que o Instagram exige, então a publicação deixa de
    // converter e de subir uma SEGUNDA cópia do mesmo post.
    const jpegBytes = await sharp(finalBytes).jpeg({ quality: 90, mozjpeg: true }).toBuffer()
    const path = `${draftId}/${crypto.randomUUID()}.jpg`
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, jpegBytes, { contentType: "image/jpeg", upsert: false })
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
