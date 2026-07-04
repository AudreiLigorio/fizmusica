import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServerClient } from "@/lib/supabase"
import { validateImageUpload } from "@/lib/imageValidation"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { getPhotoLimit, countClientPhotos } from "@/lib/photoLimit"

export const dynamic = "force-dynamic"

const BUCKET = "order-photos"

type Params = Promise<{ id: string }>

// Garante que o chamador é admin (o proxy cobre /admin/*, mas não /api/admin/*)
async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyAdminToken(token) : false
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

// ── GET: lista as fotos do pedido ──
export async function GET(req: NextRequest, { params }: { params: Params }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const supabase = createServerClient()

  const [{ data }, photoLimit] = await Promise.all([
    supabase
      .from("order_photos")
      .select("id, url, is_cover, sort_order")
      .eq("orderId", id)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true }),
    getPhotoLimit(supabase, id),
  ])

  return NextResponse.json({ photos: data ?? [], photoLimit })
}

// ── POST: admin envia uma foto (mesma validação defensiva) ──
export async function POST(req: NextRequest, { params }: { params: Params }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const supabase = createServerClient()

  const formData = await req.formData()
  const file     = formData.get("file") as File | null
  const isCover  = formData.get("is_cover") === "true"

  const v = await validateImageUpload(file)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const [limit, count] = await Promise.all([
    getPhotoLimit(supabase, id),
    countClientPhotos(supabase, id),
  ])
  if (count >= limit) {
    return NextResponse.json({ error: `Máximo de ${limit} fotos atingido.` }, { status: 400 })
  }

  await ensureBucket(supabase)

  const path = `${id}/${crypto.randomUUID()}.${v.type.ext}`
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, v.bytes, { contentType: v.type.mime, upsert: false })
  if (uploadErr) return NextResponse.json({ error: "Falha ao salvar a foto." }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  if (isCover) {
    await supabase.from("order_photos").update({ is_cover: false }).eq("orderId", id).eq("is_cover", true)
  }

  const { data: img, error: dbErr } = await supabase
    .from("order_photos")
    .insert({ orderId: id, url: publicUrl, storage_path: path, is_cover: isCover, sort_order: count ?? 0 })
    .select("id, url, is_cover, sort_order")
    .single()

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path])
    return NextResponse.json({ error: "Falha ao registrar a foto." }, { status: 500 })
  }

  return NextResponse.json({ photo: img })
}

// ── PATCH: define capa ──
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const { photoId } = await req.json().catch(() => ({}))
  if (!photoId) return NextResponse.json({ error: "Foto não informada." }, { status: 400 })

  const supabase = createServerClient()
  const { data: target } = await supabase
    .from("order_photos").select("id").eq("id", photoId).eq("orderId", id).maybeSingle()
  if (!target) return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 })

  await supabase.from("order_photos").update({ is_cover: false }).eq("orderId", id)
  await supabase.from("order_photos").update({ is_cover: true }).eq("id", photoId)
  return NextResponse.json({ ok: true })
}

// ── DELETE: remove ──
export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const { photoId } = await req.json().catch(() => ({}))
  if (!photoId) return NextResponse.json({ error: "Foto não informada." }, { status: 400 })

  const supabase = createServerClient()
  const { data: img } = await supabase
    .from("order_photos").select("storage_path").eq("id", photoId).eq("orderId", id).maybeSingle()
  if (!img) return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 })

  await supabase.storage.from(BUCKET).remove([img.storage_path])
  const { error } = await supabase.from("order_photos").delete().eq("id", photoId).eq("orderId", id)
  if (error) return NextResponse.json({ error: "Falha ao remover." }, { status: 500 })
  return NextResponse.json({ ok: true })
}
