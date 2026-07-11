import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServerClient } from "@/lib/supabase"
import { validateImageUpload } from "@/lib/imageValidation"
import { getPhotoLimit, countClientPhotos } from "@/lib/photoLimit"
import { logOrderEvent } from "@/lib/orderEvents"

export const dynamic = "force-dynamic"

const BUCKET = "order-photos"

type Params = Promise<{ id: string }>

async function resolveOrder(id: string) {
  const supabase = createServerClient()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (!isUuid) return { supabase, order: null as null | { id: string; nome: string } }

  const { data: order } = await supabase
    .from("orders")
    .select("id, nome")
    .eq("id", id)
    .maybeSingle()

  return { supabase, order: (order as any) ?? null }
}

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

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const { supabase, order } = await resolveOrder(id)
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })

  const { data } = await supabase
    .from("order_photos")
    .select("id, url, is_cover, sort_order")
    .eq("orderId", order.id)
    .order("sort_order", { ascending: true })

  return NextResponse.json({ photos: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const { supabase, order } = await resolveOrder(id)
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  const v = await validateImageUpload(file)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const [limit, count] = await Promise.all([
    getPhotoLimit(supabase, order.id),
    countClientPhotos(supabase, order.id),
  ])
  if (count >= limit) {
    return NextResponse.json({ error: `Máximo de ${limit} fotos atingido.` }, { status: 400 })
  }

  await ensureBucket(supabase)

  const path = `${order.id}/${crypto.randomUUID()}.${v.type.ext}`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, v.bytes, { contentType: v.type.mime, upsert: false })
  if (uploadErr) return NextResponse.json({ error: "Falha ao salvar a foto." }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { data: img, error: dbErr } = await supabase
    .from("order_photos")
    .insert({
      orderId:      order.id,
      url:          publicUrl,
      storage_path: path,
      is_cover:     count === 0,
      sort_order:   count,
    })
    .select("id, url, is_cover, sort_order")
    .single()

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path])
    return NextResponse.json({ error: "Falha ao registrar a foto." }, { status: 500 })
  }

  await logOrderEvent(supabase, order.id, "foto_enviada")

  return NextResponse.json({ photo: img })
}

// ── PATCH: reordena as fotos do pedido ──
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const { supabase, order } = await resolveOrder(id)
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })

  const { reorder } = await req.json().catch(() => ({}))
  if (!Array.isArray(reorder) || reorder.length === 0) {
    return NextResponse.json({ error: "Lista de fotos inválida." }, { status: 400 })
  }

  const { data: owned } = await supabase
    .from("order_photos")
    .select("id")
    .eq("orderId", order.id)
    .in("id", reorder)
  const ownedIds = new Set((owned ?? []).map((p: { id: string }) => p.id))
  if (reorder.some((pid: string) => !ownedIds.has(pid))) {
    return NextResponse.json({ error: "Foto inválida na lista." }, { status: 400 })
  }

  await Promise.all(reorder.map((pid: string, i: number) => supabase.from("order_photos").update({ sort_order: i }).eq("id", pid)))
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const { supabase, order } = await resolveOrder(id)
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })

  const { photoId } = await req.json().catch(() => ({}))
  if (!photoId) return NextResponse.json({ error: "Foto não informada." }, { status: 400 })

  const { data: img } = await supabase
    .from("order_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("orderId", order.id)
    .maybeSingle()
  if (!img) return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 })

  await supabase.storage.from(BUCKET).remove([(img as any).storage_path])
  await supabase.from("order_photos").delete().eq("id", photoId).eq("orderId", order.id)
  await logOrderEvent(supabase, order.id, "foto_removida")

  return NextResponse.json({ ok: true })
}
