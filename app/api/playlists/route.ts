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
  const { data, error } = await supabase
    .from("playlists")
    .select("id, nome, track_order_ids")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ playlists: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { nome, orderId } = await req.json().catch(() => ({}))
  const cleanNome = String(nome ?? "").trim()
  if (!cleanNome) return NextResponse.json({ error: "Dê um nome para a playlist." }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("playlists")
    .insert({ user_id: user.id, nome: cleanNome, track_order_ids: orderId ? [orderId] : [] })
    .select("id, nome, track_order_ids")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ playlist: data })
}
