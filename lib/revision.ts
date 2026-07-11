import type { createServerClient } from "@/lib/supabase"
import { logOrderEvent } from "@/lib/orderEvents"
import crypto from "crypto"

type DB = ReturnType<typeof createServerClient>

// Aceita a revisão de um pedido: duplica o pedido original como um NOVO pedido
// marcado como revisão, já PAGO e EM PRODUÇÃO, reaproveitando cadastro, respostas,
// fotos e a letra antiga. Usado tanto pelo clique manual do admin quanto pela
// aceitação automática (composer_settings.revision_auto_accept).
export async function acceptRevision(
  supabase: DB,
  orderId: string,
  actor: "admin" | "system" = "admin",
): Promise<{ ok: boolean; newOrderId?: string; error?: string }> {
  const { data: original, error: origErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single()

  if (origErr || !original) return { ok: false, error: "Pedido original não encontrado." }

  const { data: revision } = await supabase
    .from("revision_requests")
    .select("id, message, status")
    .eq("orderId", orderId)
    .eq("status", "PENDING")
    .maybeSingle()

  if (!revision) return { ok: false, error: "Não há revisão pendente para este pedido." }

  const photoToken = crypto.randomUUID()
  const now = new Date().toISOString()

  const { data: newOrder, error: newErr } = await supabase
    .from("orders")
    .insert({
      nome:               original.nome,
      email:              original.email,
      whatsapp:           original.whatsapp,
      context:            original.context,
      subcategory:        original.subcategory,
      musicalStyle:       original.musicalStyle,
      voiceType:          original.voiceType,
      emotion:            original.emotion,
      productId:          original.productId,
      deliveryOptionId:   original.deliveryOptionId,
      honoreeName:        original.honoreeName,
      userId:             original.userId,
      photo_effect:       original.photo_effect,
      photo_token:        photoToken,
      terms_accepted_at:  original.terms_accepted_at,
      terms_version:      original.terms_version,
      honoree_consent:    original.honoree_consent,
      // Reabre editável: a letra antiga vai pré-preenchida, mas o cliente revisa
      // letra/fotos e aprova de novo (a aprovação dispara a geração).
      lyricsDraft:        original.lyricsDraft,
      lyricsApproved:     false,
      status:             "IN_PRODUCTION",
      paymentStatus:      "PAID",
      is_revision:        true,
      parent_order_id:    original.id,
      revision_note:      revision.message,
      updatedAt:          now,
    })
    .select("id")
    .single()

  if (newErr || !newOrder) return { ok: false, error: newErr?.message ?? "Falha ao criar pedido de revisão." }

  const newId = newOrder.id

  const { data: answers } = await supabase
    .from("order_answers")
    .select("question, answer, position, context, subcategory")
    .eq("orderId", orderId)

  if (answers && answers.length > 0) {
    await supabase.from("order_answers").insert(answers.map((a) => ({ ...a, orderId: newId })))
  }

  // Duplica todas as fotos do pedido original, inclusive a capa gerada pela IA
  // (mantém is_cover) — fica como capa provisória até a nova música ser gerada.
  // A regeneração já zera is_cover de tudo no pedido antes de inserir a capa nova
  // (lib/suno/ingest.ts), então a antiga é substituída sem conflito.
  const { data: photos } = await supabase
    .from("order_photos")
    .select("url, storage_path, sort_order, is_cover")
    .eq("orderId", orderId)

  if (photos && photos.length > 0) {
    await supabase.from("order_photos").insert(photos.map((p) => ({ ...p, orderId: newId })))
  }

  const { data: music } = await supabase
    .from("generated_music")
    .select("lyrics, lyricsLrc, musicName, personName")
    .eq("orderId", orderId)
    .maybeSingle()

  if (music) {
    await supabase.from("generated_music").insert({
      orderId:   newId,
      lyrics:    music.lyrics,
      lyricsLrc: music.lyricsLrc,
      musicName: music.musicName,
      personName: music.personName,
    })
  }

  await supabase.from("revision_requests").update({ status: "ACCEPTED" }).eq("id", revision.id)
  await logOrderEvent(supabase, orderId, "revisao_aceita", `novo pedido #${newId.slice(0, 8).toUpperCase()}`, actor)

  // A geração NÃO é disparada aqui: o pedido de revisão volta editável para o
  // cliente (letra/fotos) e a regeneração ocorre quando ele aprova novamente,
  // seguindo o modo de produção configurado (auto/review/manual).
  return { ok: true, newOrderId: newId }
}
