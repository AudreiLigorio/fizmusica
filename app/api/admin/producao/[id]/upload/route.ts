import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

type Params = Promise<{ id: string }>

// POST — faz upload de MP3 para o bucket `songs` e retorna a URL pública
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 })
  }

  if (!file.name.endsWith(".mp3") && file.type !== "audio/mpeg") {
    return NextResponse.json({ error: "Apenas arquivos MP3 são aceitos." }, { status: 400 })
  }

  const supabase = createServerClient()
  const fileName = `orders/${id}/${Date.now()}.mp3`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from("songs")
    .upload(fileName, arrayBuffer, {
      contentType: "audio/mpeg",
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from("songs").getPublicUrl(fileName)

  return NextResponse.json({ url: urlData.publicUrl })
}
