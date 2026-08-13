import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServerClient } from "@/lib/supabase"
import { validateImageUpload } from "@/lib/imageValidation"
import { otimizarFoto } from "@/lib/imageResize"
import { renumerarFotos } from "@/lib/photoOrder"
import { getPhotoLimit, countClientPhotos } from "@/lib/photoLimit"
import { logOrderEvent } from "@/lib/orderEvents"

export const dynamic = "force-dynamic"

const BUCKET = "order-photos"

type Params = Promise<{ token: string }>

// Resolve o pedido pelo token de acesso (sem login). Exige pagamento confirmado.
async function resolveOrder(token: string) {
  const supabase = createServerClient()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)
  if (!isUuid) return { supabase, order: null as null | { id: string; nome: string; paymentStatus: string } }

  const { data: order } = await supabase
    .from("orders")
    .select("id, nome, paymentStatus")
    .eq("photo_token", token)
    .maybeSingle()

  return { supabase, order: (order as any) ?? null }
}

// Plano sem fotos (photo_limit = 0) não permite adicionar, excluir NEM
// reordenar. O POST já era barrado pela contagem contra o limite; excluir e
// reordenar passavam batido — e num pedido desses a única imagem existente é
// a capa gerada pela IA, que o cliente conseguiria apagar.
async function bloqueiaSeSemFotos(supabase: ReturnType<typeof createServerClient>, orderId: string) {
  const limite = await getPhotoLimit(supabase, orderId)
  if (limite > 0) return null
  return NextResponse.json(
    { error: "O plano contratado não inclui fotos." },
    { status: 403 },
  )
}

// Garante que o bucket existe (executa na Vercel, que alcança o Supabase).
async function ensureBucket(supabase: ReturnType<typeof createServerClient>) {
  const { data } = await supabase.storage.getBucket(BUCKET)
  if (!data) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      fileSizeLimit: "8MB",
    })
  }
}

// ── GET: lista as fotos do pedido ──
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { token } = await params
  const { supabase, order } = await resolveOrder(token)
  if (!order) return NextResponse.json({ error: "Link inválido." }, { status: 404 })

  const [{ data }, photoLimit] = await Promise.all([
    supabase
      .from("order_photos")
      .select("id, url, is_cover, sort_order")
      .eq("orderId", order.id)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true }),
    getPhotoLimit(supabase, order.id),
  ])

  return NextResponse.json({ nome: order.nome, photos: data ?? [], photoLimit })
}

// ── POST: envia uma foto (validação defensiva completa) ──
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { token } = await params
  const { supabase, order } = await resolveOrder(token)
  if (!order) return NextResponse.json({ error: "Link inválido." }, { status: 404 })
  if (order.paymentStatus !== "PAID") {
    return NextResponse.json({ error: "Pagamento não confirmado." }, { status: 403 })
  }

  const formData = await req.formData()
  const file     = formData.get("file") as File | null
  const isCover  = formData.get("is_cover") === "true"

  // Validação por bytes — bloqueia arquivos disfarçados
  const v = await validateImageUpload(file)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  // Limite de fotos por pedido (parametrizado pelo produto)
  const [limit, count] = await Promise.all([
    getPhotoLimit(supabase, order.id),
    countClientPhotos(supabase, order.id),
  ])
  if (count >= limit) {
    return NextResponse.json({ error: `Máximo de ${limit} fotos atingido.` }, { status: 400 })
  }

  await ensureBucket(supabase)

  // Nome aleatório gerado no servidor — nunca o nome do usuário (evita path traversal)
  // Comprime antes de guardar: o player só precisa da largura da tela,
  // e foto de celular chega com 3 a 5 MB.
  const foto = await otimizarFoto(v.bytes)
  const path = `${order.id}/${crypto.randomUUID()}.${foto.ext}`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, foto.bytes, { contentType: foto.mime, upsert: false })
  if (uploadErr) return NextResponse.json({ error: "Falha ao salvar a foto." }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  // Se marcada como capa, desmarca a capa anterior
  if (isCover) {
    await supabase.from("order_photos").update({ is_cover: false }).eq("orderId", order.id).eq("is_cover", true)
  }

  const { data: img, error: dbErr } = await supabase
    .from("order_photos")
    .insert({
      orderId:      order.id,
      url:          publicUrl,
      storage_path: path,
      is_cover:     isCover,
      sort_order:   count ?? 0,
    })
    .select("id, url, is_cover, sort_order")
    .single()


  if (dbErr) {
    // rollback do storage se o insert falhar
    await supabase.storage.from(BUCKET).remove([path])
    return NextResponse.json({ error: "Falha ao registrar a foto." }, { status: 500 })
  }

  // Mantém a numeração sequencial: upload simultâneo dava número repetido.
  await renumerarFotos(supabase, order.id)

  await logOrderEvent(supabase, order.id, "foto_enviada")

  return NextResponse.json({ photo: img })
}

// ── PATCH: define uma foto como capa, ou reordena as fotos do cliente ──
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const { token } = await params
  const { supabase, order } = await resolveOrder(token)
  if (!order) return NextResponse.json({ error: "Link inválido." }, { status: 404 })
  const bloqueio = await bloqueiaSeSemFotos(supabase, order.id)
  if (bloqueio) return bloqueio

  const body = await req.json().catch(() => ({}))

  if (Array.isArray(body.reorder)) {
    const ids: string[] = body.reorder
    // Só reordena fotos do cliente (nunca a capa gerada pela IA) e que pertençam a este pedido
    const { data: owned } = await supabase
      .from("order_photos")
      .select("id")
      .eq("orderId", order.id)
      .eq("is_cover", false)
      .in("id", ids)
    const ownedIds = new Set((owned ?? []).map((p: { id: string }) => p.id))
    if (ids.length === 0 || ids.some((id) => !ownedIds.has(id))) {
      return NextResponse.json({ error: "Lista de fotos inválida." }, { status: 400 })
    }
    await Promise.all(ids.map((id, i) => supabase.from("order_photos").update({ sort_order: i }).eq("id", id)))
    return NextResponse.json({ ok: true })
  }

  const { photoId } = body
  if (!photoId) return NextResponse.json({ error: "Foto não informada." }, { status: 400 })

  // Confirma que a foto pertence a este pedido
  const { data: target } = await supabase
    .from("order_photos")
    .select("id")
    .eq("id", photoId)
    .eq("orderId", order.id)
    .maybeSingle()
  if (!target) return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 })

  await supabase.from("order_photos").update({ is_cover: false }).eq("orderId", order.id)
  await supabase.from("order_photos").update({ is_cover: true }).eq("id", photoId)
  await logOrderEvent(supabase, order.id, "capa_definida")
  await renumerarFotos(supabase, order.id)

  return NextResponse.json({ ok: true })
}

// ── DELETE: remove uma foto ──
export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const { token } = await params
  const { supabase, order } = await resolveOrder(token)
  if (!order) return NextResponse.json({ error: "Link inválido." }, { status: 404 })
  const bloqueio = await bloqueiaSeSemFotos(supabase, order.id)
  if (bloqueio) return bloqueio

  const { photoId } = await req.json().catch(() => ({}))
  if (!photoId) return NextResponse.json({ error: "Foto não informada." }, { status: 400 })

  const { data: img } = await supabase
    .from("order_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("orderId", order.id)
    .maybeSingle()
  if (!img) return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 })

  await supabase.storage.from(BUCKET).remove([img.storage_path])
  const { error } = await supabase.from("order_photos").delete().eq("id", photoId).eq("orderId", order.id)
  if (error) return NextResponse.json({ error: "Falha ao remover." }, { status: 500 })
  await logOrderEvent(supabase, order.id, "foto_removida")
  await renumerarFotos(supabase, order.id)

  return NextResponse.json({ ok: true })
}
