import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { urlAssinadaDoAudio } from "@/lib/audioUrl"

type Params = Promise<{ id: string }>

// GET — busca dados de produção de um pedido
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("generated_music")
    .select("*")
    .eq("orderId", id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // `mp3UrlAssinada` vai SEPARADA de propósito. O bucket songs é privado e a
  // URL gravada não abre mais, mas `mp3Url` é campo EDITÁVEL do formulário e
  // volta no POST: se a assinada ocupasse o lugar dele, o admin salvaria a
  // URL temporária por cima da definitiva e a música morreria em 30 min.
  // Uma toca, a outra é o dado.
  const mp3UrlAssinada = data?.mp3Url ? await urlAssinadaDoAudio(supabase, data.mp3Url) : null
  return NextResponse.json({ music: data ? { ...data, mp3UrlAssinada } : data })
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
        orderId:     id,
        mp3Url:      body.mp3Url    ?? null,
        imageUrl:    body.imageUrl  ?? null,
        lyrics:      body.lyrics    ?? null,
        lyricsLrc:   body.lyricsLrc ?? null,
        musicName:   body.musicName?.trim()  || null,
        personName:  body.personName?.trim() || null,
        publishedAt: body.mp3Url ? new Date().toISOString() : null,
        updatedAt:   new Date().toISOString(),
      },
      { onConflict: "orderId" }
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
