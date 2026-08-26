import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { generateMusicTitle } from "@/lib/composer/title"

export const dynamic = "force-dynamic"

// Sugere um título a partir da letra que está na tela, para o cliente ver e
// poder trocar antes de aprovar.
//
// Não grava nada de propósito: o cliente ainda tem revisões de letra, e um
// título salvo agora ficaria desalinhado quando a letra mudasse. Só a
// aprovação persiste (letra/aprovar), com o texto que o cliente confirmou.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { lyrics } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("paymentStatus, lyricsDraft, lyricsApproved")
    .eq("id", id)
    .single()

  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  if (order.paymentStatus !== "PAID") return NextResponse.json({ error: "Pedido ainda não está pago." }, { status: 403 })

  const base = (lyrics ?? order.lyricsDraft ?? "").trim()
  if (!base) return NextResponse.json({ error: "Não há letra para criar um título." }, { status: 400 })

  const titulo = await generateMusicTitle(base)
  if (!titulo) return NextResponse.json({ error: "Não consegui criar um título agora." }, { status: 502 })

  return NextResponse.json({ titulo })
}
