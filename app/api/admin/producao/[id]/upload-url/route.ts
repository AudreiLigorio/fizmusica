import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

type Params = Promise<{ id: string }>

// Gera uma URL assinada para o browser fazer upload direto ao Supabase Storage
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const supabase = createServerClient()

  const fileName = `orders/${id}/${Date.now()}.mp3`

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
