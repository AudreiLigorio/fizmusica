import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("product_images")
    .select("id, url, storage_path, is_cover, sort_order")
    .eq("product_id", id)
    .order("is_cover", { ascending: false })
    .order("sort_order", { ascending: true })

  if (error) return NextResponse.json({ images: [] })
  return NextResponse.json({ images: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const isCover = formData.get("is_cover") === "true"
  const sortOrder = Number(formData.get("sort_order") ?? 0)

  if (!file) return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 })

  // Checa limite: 1 capa + 4 fotos
  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id)
    .eq("is_cover", false)

  if (!isCover && (count ?? 0) >= 4) {
    return NextResponse.json({ error: "Máximo de 4 fotos adicionais atingido." }, { status: 400 })
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  // Nome único também para a capa: a URL pública muda a cada upload, evitando que o
  // CDN/navegador sirvam a capa antiga do cache (a capa anterior é removida abaixo).
  const path = `${id}/${isCover ? `cover_${Date.now()}` : `photo_${sortOrder}_${Date.now()}`}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path)

  // Se for capa, remove a capa anterior
  if (isCover) {
    const { data: old } = await supabase
      .from("product_images")
      .select("storage_path")
      .eq("product_id", id)
      .eq("is_cover", true)
      .single()

    if (old?.storage_path) {
      await supabase.storage.from("product-images").remove([old.storage_path])
    }
    await supabase.from("product_images").delete().eq("product_id", id).eq("is_cover", true)
  }

  const { data: img, error: dbErr } = await supabase
    .from("product_images")
    .insert({ product_id: id, url: publicUrl, storage_path: path, is_cover: isCover, sort_order: sortOrder })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ image: img })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { imageId } = await req.json()
  const supabase = createServerClient()

  const { data: img } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("id", imageId)
    .eq("product_id", id)
    .single()

  if (img?.storage_path) {
    await supabase.storage.from("product-images").remove([img.storage_path])
  }

  const { error } = await supabase.from("product_images").delete().eq("id", imageId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
