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

// Adiciona uma música (drag-and-drop numa playlist já existente) — idempotente,
// não duplica se a faixa já estiver lá.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const { id } = await params
  const { addOrderId } = await req.json().catch(() => ({}))
  if (!addOrderId) return NextResponse.json({ error: "Faixa inválida." }, { status: 400 })

  const supabase = createServerClient()
  const { data: pl, error: findErr } = await supabase
    .from("playlists")
    .select("track_order_ids")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()
  if (findErr || !pl) return NextResponse.json({ error: "Playlist não encontrada." }, { status: 404 })

  const ids: string[] = pl.track_order_ids ?? []
  if (!ids.includes(addOrderId)) ids.push(addOrderId)

  const { data, error } = await supabase
    .from("playlists")
    .update({ track_order_ids: ids, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, nome, track_order_ids")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ playlist: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const { id } = await params

  const supabase = createServerClient()
  const { error } = await supabase.from("playlists").delete().eq("id", id).eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
