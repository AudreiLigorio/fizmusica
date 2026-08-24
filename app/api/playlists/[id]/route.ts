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

// Detalhe da playlist — resolve os ids em faixas tocáveis (título, capa,
// áudio). Título é sempre o derivado da ocasião, nunca o real do Suno:
// a playlist pode ter música de outra conta (favoritada na Rede Fiz
// Música), então a mesma regra de privacidade do catálogo vale aqui.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const { id } = await params

  const supabase = createServerClient()
  const { data: pl, error: findErr } = await supabase
    .from("playlists")
    .select("id, nome, track_order_ids")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()
  if (findErr || !pl) return NextResponse.json({ error: "Playlist não encontrada." }, { status: 404 })

  const ids: string[] = pl.track_order_ids ?? []
  if (ids.length === 0) return NextResponse.json({ playlist: pl, tracks: [] })

  const { data: orders } = await supabase.from("orders").select("id, subcategory, sunoTracks").in("id", ids)
  const { data: gm } = await supabase.from("generated_music").select("orderId, mp3Url").in("orderId", ids)
  const mp3ByOrder: Record<string, string | null> = {}
  for (const g of gm ?? []) mp3ByOrder[g.orderId as string] = g.mp3Url ?? null

  type Track = { audioUrl: string; imageUrl: string | null }
  const byId: Record<string, { subcategory: string; sunoTracks: Track[] | null }> = {}
  for (const o of orders ?? []) byId[o.id] = { subcategory: o.subcategory, sunoTracks: (o.sunoTracks as Track[] | null) ?? null }

  const tracks = ids
    .map((orderId) => {
      const o = byId[orderId]
      if (!o) return null
      const mp3Url = mp3ByOrder[orderId]
      const principal = o.sunoTracks?.find((t) => t.audioUrl === mp3Url) ?? o.sunoTracks?.[0]
      if (!principal?.audioUrl) return null
      return {
        orderId,
        title: `Uma canção de ${o.subcategory}`,
        occasion: o.subcategory,
        imageUrl: principal.imageUrl,
        audioUrl: principal.audioUrl,
      }
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)

  return NextResponse.json({ playlist: pl, tracks })
}

// Adiciona ou remove uma música (drag-and-drop, ou botão de remover na tela
// de detalhe) — idempotente, não duplica se a faixa já estiver lá.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const { id } = await params
  const { addOrderId, removeOrderId } = await req.json().catch(() => ({}))
  if (!addOrderId && !removeOrderId) return NextResponse.json({ error: "Faixa inválida." }, { status: 400 })

  const supabase = createServerClient()
  const { data: pl, error: findErr } = await supabase
    .from("playlists")
    .select("track_order_ids")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()
  if (findErr || !pl) return NextResponse.json({ error: "Playlist não encontrada." }, { status: 404 })

  let ids: string[] = pl.track_order_ids ?? []
  if (addOrderId && !ids.includes(addOrderId)) ids.push(addOrderId)
  if (removeOrderId) ids = ids.filter((i) => i !== removeOrderId)

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
