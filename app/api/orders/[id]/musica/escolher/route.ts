import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServerClient } from "@/lib/supabase"
import { getTimestampedLyrics } from "@/lib/suno/client"
import { alignedWordsToLrc } from "@/lib/suno/lrc"
import { logOrderEvent } from "@/lib/orderEvents"

export const dynamic = "force-dynamic"
export const maxDuration = 30

function generateSlug(orderId: string): string {
  const short = orderId.replace(/-/g, "").slice(0, 8)
  const rand = Math.random().toString(36).slice(2, 6)
  return `${short}${rand}`
}

// Cliente escolhe uma das versões geradas. Grava a faixa como oficial, gera o LRC
// sincronizado dela e finaliza o pedido (slug + DELIVERED). Sem e-mail (já está na área).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { audioId } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id, paymentStatus, sunoStatus, sunoTracks, sunoTaskId")
    .eq("id", id)
    .single()

  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  if (order.paymentStatus !== "PAID") return NextResponse.json({ error: "Pedido não está pago." }, { status: 403 })
  if (order.sunoStatus !== "RELEASED") return NextResponse.json({ error: "As versões ainda não foram liberadas." }, { status: 409 })

  const tracks = Array.isArray(order.sunoTracks) ? order.sunoTracks : []
  const track = tracks.find((t: any) => t.audioId === audioId)
  if (!track) return NextResponse.json({ error: "Versão inválida." }, { status: 400 })

  // LRC sincronizado da faixa escolhida (sem marcadores de seção).
  let lyricsLrc: string | null = null
  try {
    const tl: any = await getTimestampedLyrics(order.sunoTaskId, audioId)
    const words = tl?.data?.alignedWords
    if (Array.isArray(words) && words.length) lyricsLrc = alignedWordsToLrc(words)
  } catch (e) {
    console.error("[musica/escolher] LRC falhou", e instanceof Error ? e.message : e)
  }

  // Slug do player (gera se ainda não houver)
  const { data: music } = await supabase
    .from("generated_music").select("slug, publishedAt").eq("orderId", id).maybeSingle()
  const slug = (music?.slug as string | null) ?? generateSlug(id)

  const { error: gmErr } = await supabase.from("generated_music").upsert({
    orderId: id,
    mp3Url: track.audioUrl,
    imageUrl: track.imageUrl,
    ...(lyricsLrc ? { lyricsLrc } : {}),
    slug,
    publishedAt: music?.publishedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { onConflict: "orderId" })
  if (gmErr) return NextResponse.json({ error: gmErr.message }, { status: 500 })

  await supabase.from("orders").update({ status: "DELIVERED", updatedAt: new Date().toISOString() }).eq("id", id)
  await logOrderEvent(supabase, id, "versao_principal_alterada", `versão ${audioId}${track.duration ? ` (${Math.round(track.duration)}s)` : ""}`)

  // Cria o pedido de feedback (uma vez) — o cron envia o e-mail após o prazo.
  // Idempotente: trocar a versão principal depois não duplica.
  const { data: existingFb } = await supabase.from("feedbacks").select("id").eq("orderId", id).maybeSingle()
  if (!existingFb) {
    await supabase.from("feedbacks").insert({ orderId: id, token: crypto.randomUUID() })
  }

  return NextResponse.json({ ok: true, slug })
}
