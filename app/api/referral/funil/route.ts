import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

async function getUserFromAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function GET(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const supabase = createServerClient()
  const { data: rc } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!rc) return NextResponse.json({ code: null, shares: 0, accesses: 0, conversions: 0 })

  const { count: shares } = await supabase
    .from("referral_events").select("id", { count: "exact", head: true })
    .eq("code", rc.code).eq("type", "share")

  const { count: accesses } = await supabase
    .from("referral_events").select("id", { count: "exact", head: true })
    .eq("code", rc.code).eq("type", "access")

  // Conversão é derivada (ver comentário na migração 047): pedido pago com
  // esse código, cuja conta não é a mesma de quem indicou (antifraude básico
  // — sem isso, o próprio indicador poderia "converter" usando o link nele mesmo).
  const { count: conversions } = await supabase
    .from("orders").select("id", { count: "exact", head: true })
    .eq("referral_code", rc.code).eq("paymentStatus", "PAID")
    .or(`userId.is.null,userId.neq.${user.id}`)

  return NextResponse.json({ code: rc.code, shares: shares ?? 0, accesses: accesses ?? 0, conversions: conversions ?? 0 })
}
