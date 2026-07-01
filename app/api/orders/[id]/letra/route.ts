import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export const REPROCESS_LIMIT = 3

// Estado atual da letra do pedido (para a tela do cliente).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("orders")
    .select("paymentStatus, lyricsDraft, lyricsApproved, lyricsReprocessCount")
    .eq("id", id)
    .single()

  if (error || !data) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })

  const used = data.lyricsReprocessCount ?? 0
  return NextResponse.json({
    paymentStatus:  data.paymentStatus,
    lyricsDraft:    data.lyricsDraft ?? null,
    lyricsApproved: !!data.lyricsApproved,
    reprocessUsed:  used,
    reprocessLeft:  Math.max(0, REPROCESS_LIMIT - used),
  })
}
