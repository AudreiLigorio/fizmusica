import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import crypto from "crypto"

export const dynamic = "force-dynamic"

type Params = Promise<{ id: string }>

// Aceita a revisão de um pedido: duplica o pedido original como um NOVO pedido
// marcado como revisão, já PAGO e EM PRODUÇÃO, reaproveitando cadastro, respostas,
// fotos e a letra antiga. A mensagem da contestação vai em revision_note.
export async function POST(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params
    const supabase = createServerClient()

    // 1. Pedido original
    const { data: original, error: origErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single()

    if (origErr || !original) {
      return NextResponse.json({ error: "Pedido original não encontrado." }, { status: 404 })
    }

    // 2. Revisão pendente
    const { data: revision } = await supabase
      .from("revision_requests")
      .select("id, message, status")
      .eq("orderId", id)
      .eq("status", "PENDING")
      .maybeSingle()

    if (!revision) {
      return NextResponse.json({ error: "Não há revisão pendente para este pedido." }, { status: 400 })
    }

    // 3. Cria o novo pedido (cópia + flags de revisão)
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

    if (newErr || !newOrder) {
      return NextResponse.json({ error: newErr?.message ?? "Falha ao criar pedido de revisão." }, { status: 500 })
    }

    const newId = newOrder.id

    // 4. Copia respostas do wizard
    const { data: answers } = await supabase
      .from("order_answers")
      .select("question, answer, position, context, subcategory")
      .eq("orderId", id)

    if (answers && answers.length > 0) {
      await supabase.from("order_answers").insert(
        answers.map((a) => ({ ...a, orderId: newId }))
      )
    }

    // 5. Copia as fotos do cliente (mesmas URLs). Exclui a capa antiga da IA —
    //    uma nova capa é gerada na regeneração. Fotos copiadas nunca são capa.
    const { data: photos } = await supabase
      .from("order_photos")
      .select("url, storage_path, sort_order")
      .eq("orderId", id)
      .not("storage_path", "like", "%suno-cover%")

    if (photos && photos.length > 0) {
      await supabase.from("order_photos").insert(
        photos.map((p) => ({ ...p, orderId: newId, is_cover: false }))
      )
    }

    // 6. Copia a letra antiga (melodia/MP3 NÃO — refeita do zero)
    const { data: music } = await supabase
      .from("generated_music")
      .select("lyrics, lyricsLrc, musicName, personName")
      .eq("orderId", id)
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

    // 7. Marca a revisão original como aceita
    await supabase
      .from("revision_requests")
      .update({ status: "ACCEPTED" })
      .eq("id", revision.id)

    // A geração NÃO é disparada aqui: o pedido de revisão volta editável para o
    // cliente (letra/fotos) e a regeneração ocorre quando ele aprova novamente.
    // A instrução (revision_note) é aplicada no disparo a partir da aprovação.

    return NextResponse.json({ ok: true, newOrderId: newId })
  } catch (err: any) {
    console.error("[aceitar-revisao] erro:", err)
    return NextResponse.json({ error: err?.message ?? "Erro interno" }, { status: 500 })
  }
}
