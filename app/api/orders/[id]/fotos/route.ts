import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServerClient } from "@/lib/supabase"
import { validateImageUpload } from "@/lib/imageValidation"

export const dynamic = "force-dynamic"

const BUCKET     = "order-photos"
const MAX_PHOTOS = 5

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

  const { count } = await supabase
    .from("order_photos")
    .select("id", { count: "exact", head: true })
    .eq("orderId", order.id)
  if ((count ?? 0) >= MAX_PHOTOS) {
    return NextResponse.json({ error: `Máximo de ${MAX_PHOTOS} fotos atingido.` }, { status: 400 })
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
      is_cover:     (count ?? 0) === 0,
      sort_order:   count ?? 0,
    })
    .select("id, url, is_cover, sort_order")
    .single()

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path])
    return NextResponse.json({ error: "Falha ao registrar a foto." }, { status: 500 })
  }

  return NextResponse.json({ photo: img })
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

  return NextResponse.json({ ok: true })
}
