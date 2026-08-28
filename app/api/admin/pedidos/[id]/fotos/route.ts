import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServerClient } from "@/lib/supabase"
import { validateImageUpload } from "@/lib/imageValidation"
import { otimizarFoto } from "@/lib/imageResize"
import { renumerarFotos } from "@/lib/photoOrder"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { getPhotoLimit, countClientPhotos } from "@/lib/photoLimit"
import { logOrderEvent } from "@/lib/orderEvents"

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

  // O bucket order-photos ficou privado. O admin já está autenticado no
  // servidor (cookie HMAC + verifyAdminToken), então aqui a URL é assinada
  // direto na resposta, sem precisar de rota intermediária como o cliente.
  return NextResponse.json({ photos: await assinarFotos(supabase, data ?? []), photoLimit })
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

  // Comprime antes de guardar: o player só precisa da largura da tela,
  // e foto de celular chega com 3 a 5 MB.
  const foto = await otimizarFoto(v.bytes)
  const path = `${id}/${crypto.randomUUID()}.${foto.ext}`
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, foto.bytes, { contentType: foto.mime, upsert: false })
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

  // Mantém a numeração sequencial: upload simultâneo dava número repetido.
  await renumerarFotos(supabase, id)

  await logOrderEvent(supabase, id, "foto_enviada", undefined, "admin")

  // Assinada também: sem isso a foto recém-enviada apareceria quebrada no
  // admin até a próxima recarga.
  return NextResponse.json({ photo: (await assinarFotos(supabase, [img]))[0] })
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
  await logOrderEvent(supabase, id, "capa_definida", undefined, "admin")
  await renumerarFotos(supabase, id)
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
  await logOrderEvent(supabase, id, "foto_removida", undefined, "admin")
  await renumerarFotos(supabase, id)
  return NextResponse.json({ ok: true })
}

// Troca a URL pública (inutilizável desde que o bucket fechou) por uma
// assinada e temporária. Foto sem caminho reconhecível é devolvida como
// estava — melhor uma imagem quebrada isolada que a lista inteira falhar.
type FotoLinha = { id: string; url: string; is_cover: boolean; sort_order: number }
async function assinarFotos(
  supabase: ReturnType<typeof createServerClient>,
  fotos: FotoLinha[],
): Promise<FotoLinha[]> {
  return Promise.all(
    fotos.map(async (f) => {
      const m = (f.url ?? "").match(/\/storage\/v1\/object\/(?:public|sign)\/order-photos\/(.+?)(?:\?|$)/)
      if (!m) return f
      const { data } = await supabase.storage
        .from("order-photos")
        .createSignedUrl(decodeURIComponent(m[1]), 60 * 60)
      return data?.signedUrl ? { ...f, url: data.signedUrl } : f
    }),
  )
}
