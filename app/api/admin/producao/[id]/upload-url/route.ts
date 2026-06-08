import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

type Params = Promise<{ id: string }>

// Gera uma URL assinada para o browser fazer upload direto ao Supabase Storage
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const supabase = createServerClient()

  // Extensão do arquivo (mp3 por padrão; imagens passam "jpg", "png", etc.)
  let ext = "mp3"
  try {
    const body = await req.json()
    if (body?.ext && /^[a-z0-9]{2,5}$/i.test(body.ext)) ext = body.ext.toLowerCase()
  } catch {
    // sem body — mantém mp3
  }

  const fileName = `orders/${id}/${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from("songs")
    .createSignedUploadUrl(fileName)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Falha ao gerar URL" }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from("songs").getPublicUrl(fileName)

  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl: urlData.publicUrl,
  })
}
