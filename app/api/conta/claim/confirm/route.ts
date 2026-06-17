import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// Link clicado no e-mail da COMPRA: confirma a posse e vincula o pedido à conta.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"
  if (!token) return NextResponse.redirect(`${baseUrl}/minha-musica?reivindicado=erro`)

  const supabase = createServerClient()

  const { data: claim } = await supabase
    .from("order_claims")
    .select("id, orderId, userId, confirmedAt")
    .eq("token", token)
    .maybeSingle()

  if (!claim) return NextResponse.redirect(`${baseUrl}/minha-musica?reivindicado=erro`)

  if (!claim.confirmedAt) {
    await supabase.from("orders").update({ userId: claim.userId }).eq("id", claim.orderId)
    await supabase.from("order_claims").update({ confirmedAt: new Date().toISOString() }).eq("id", claim.id)
  }

  return NextResponse.redirect(`${baseUrl}/minha-musica?reivindicado=ok`)
}
