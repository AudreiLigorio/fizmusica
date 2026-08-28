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

  const { data: orders } = await supabase.from("orders").select("id, subcategory, sunoTracks, userId").in("id", ids)
  const { data: gm } = await supabase.from("generated_music").select("orderId, mp3Url, musicName, musicNameConfirmed").in("orderId", ids)
  const musicByOrder: Record<string, { mp3Url: string | null; musicName: string | null; confirmado: boolean }> = {}
  for (const g of gm ?? []) musicByOrder[g.orderId as string] = {
    mp3Url: g.mp3Url ?? null,
    musicName: g.musicName ?? null,
    confirmado: !!g.musicNameConfirmed,
  }

  // Apelido do autor: do próprio dono sempre; de terceiros só com o opt-in
  // (mesma regra do catálogo — publication_consent não cobre identidade).
  const ownerIds = [...new Set((orders ?? []).map((o) => o.userId).filter(Boolean))] as string[]
  const { data: perfis } = ownerIds.length
    ? await supabase.from("profiles").select("user_id, apelido, mostrar_apelido").in("user_id", ownerIds)
    : { data: [] }
  const apelidoPorUser: Record<string, string> = {}
  for (const p of perfis ?? []) {
    const proprio = p.user_id === user.id
    if ((proprio || p.mostrar_apelido) && p.apelido?.trim()) apelidoPorUser[p.user_id as string] = p.apelido.trim()
  }

  type Track = { audioUrl: string; imageUrl: string | null }
  const byId: Record<string, { subcategory: string; sunoTracks: Track[] | null; userId: string | null }> = {}
  for (const o of orders ?? []) byId[o.id] = {
    subcategory: o.subcategory,
    sunoTracks: (o.sunoTracks as Track[] | null) ?? null,
    userId: (o.userId as string | null) ?? null,
  }

  const tracks = ids
    .map((orderId) => {
      const o = byId[orderId]
      if (!o) return null
      const music = musicByOrder[orderId]
      const principal = o.sunoTracks?.find((t) => t.audioUrl === music?.mp3Url) ?? o.sunoTracks?.[0]
      // Entrega antiga (manual) não tem sunoTracks — o áudio está só no
      // mp3Url. Sem esse fallback a faixa sumia da playlist, e a contagem do
      // card ("3 músicas") não batia com o que aparecia na raia.
      const audioUrl = principal?.audioUrl ?? music?.mp3Url ?? null
      if (!audioUrl) return null
      // Mesma regra do catálogo: nome real só quando o cliente confirmou — ou
      // sempre, se a música é do próprio dono da playlist.
      const proprio = !!o.userId && o.userId === user.id
      const nome = music?.musicName?.trim()
      return {
        orderId,
        title: nome && (music?.confirmado || proprio) ? nome : `Uma canção de ${o.subcategory}`,
        occasion: o.subcategory,
        imageUrl: principal?.imageUrl ?? null,
        // Rota guardada, não o link do arquivo (ver /api/audio).
        audioUrl: `/api/audio?o=${orderId}`,
        apelido: o.userId ? apelidoPorUser[o.userId] ?? null : null,
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
