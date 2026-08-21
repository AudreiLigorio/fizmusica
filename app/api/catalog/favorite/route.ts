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

// Toggle — chama uma vez pra favoritar, de novo pra desfavoritar.
export async function POST(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { orderId } = await req.json().catch(() => ({}))
  if (!orderId) return NextResponse.json({ error: "Música inválida." }, { status: 400 })

  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from("catalog_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("order_id", orderId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from("catalog_favorites").delete().eq("id", existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ favorited: false })
  }

  const { error } = await supabase.from("catalog_favorites").insert({ user_id: user.id, order_id: orderId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ favorited: true })
}
