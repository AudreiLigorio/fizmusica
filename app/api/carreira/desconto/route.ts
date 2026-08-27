import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { descontoDeFidelidade } from "@/lib/fidelidade"

export const dynamic = "force-dynamic"

// Desconto de fidelidade deste cliente pra este produto — usado pelo checkout
// pra MOSTRAR o valor antes de pagar. Quem cobra é /api/payments/create, e os
// dois usam a mesma função: sem isso o cliente veria um preço e pagaria outro.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return NextResponse.json({ desconto: 0, percentual: 0 })

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: u } = await anon.auth.getUser(token)
  if (!u.user) return NextResponse.json({ desconto: 0, percentual: 0 })

  const { productId, total } = await req.json().catch(() => ({}))
  const bruto = Number(total)
  if (!Number.isFinite(bruto) || bruto <= 0) return NextResponse.json({ desconto: 0, percentual: 0 })

  const supabase = createServerClient()
  let fisico = false
  if (productId) {
    const { data: p } = await supabase.from("products").select("category").eq("id", productId).maybeSingle()
    fisico = (p?.category as string | null ?? "").toUpperCase().includes("PHYSICAL")
  }

  const fid = await descontoDeFidelidade(supabase, u.user.id, bruto, fisico)
  return NextResponse.json({
    desconto: fid.desconto,
    percentual: fid.percentual,
    nivelId: fid.nivel?.id ?? null,
    nivelNome: fid.nivel?.nome ?? null,
    nivelIcone: fid.nivel?.icone ?? null,
  })
}
