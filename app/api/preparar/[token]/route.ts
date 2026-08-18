import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// Resolve o photo_token → resumo do pedido para a página-ponte /preparar/[token].
// Pedido pago exige login ali (o token prova posse, mas quem entra vira dono de
// verdade); o e-mail vem junto pra oferecer o link mágico sem pedir pra digitar
// de novo. Letra (por orderId) e fotos (por token) reusam endpoints existentes;
// aqui só entregamos o estado para a página decidir o que renderizar.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 400 })

  const supabase = createServerClient()
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, paymentStatus, status, lyricsApproved, honoreeName, subcategory, is_revision, photo_token, emotion, sunoStatus, sunoTracks, email")
    .eq("photo_token", token)
    .maybeSingle()

  if (error || !order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  }

  // slug da música (quando já entregue) para mandar direto ao player
  const { data: music } = await supabase
    .from("generated_music")
    .select("slug")
    .eq("orderId", order.id)
    .maybeSingle()

  return NextResponse.json({
    order: {
      id:             order.id,
      paymentStatus:  order.paymentStatus,
      status:         order.status,
      lyricsApproved: order.lyricsApproved,
      honoreeName:    order.honoreeName,
      subcategory:    order.subcategory,
      is_revision:    order.is_revision,
      email:          order.email,
      emotion:        order.emotion,
      sunoStatus:     order.sunoStatus ?? null,
      tracks:         order.sunoTracks ?? null,
      slug:           music?.slug ?? null,
    },
  })
}
