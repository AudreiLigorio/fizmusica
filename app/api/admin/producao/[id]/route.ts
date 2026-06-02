import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

type Params = Promise<{ id: string }>

// GET — busca dados de produção de um pedido
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("generated_music")
    .select("*")
    .eq("order_id", id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ music: data })
}

// POST — salva/atualiza dados da música produzida
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const body = await req.json()
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("generated_music")
    .upsert(
      {
        order_id:    id,
        mp3_url:     body.mp3Url   ?? null,
        lyrics:      body.lyrics   ?? null,
        image_url:   body.imageUrl ?? null,
        music_name:  body.musicName ?? null,
        person_name: body.personName ?? null,
        published_at: body.mp3Url ? new Date().toISOString() : null,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: "order_id" }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Atualiza status do pedido para DELIVERED quando há URL do MP3
  if (body.mp3Url) {
    await supabase
      .from("orders")
      .update({ status: "DELIVERED", updatedAt: new Date().toISOString() })
      .eq("id", id)
  }

  return NextResponse.json({ music: data })
}
