import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { PLAN_FEATURE_COLUMNS, featuresFromProduct } from "@/lib/planFeatures"
import { lrcToPlainLyrics } from "@/lib/suno/lrc"

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

// Catálogo público (dentro da área logada) — só pedido entregue, com
// autorização de divulgação e com capa gerada pelo Suno. NUNCA lê
// order_photos (fotos do cliente) — só sunoTracks, então não tem como
// vazar foto real por engano aqui. Nome do homenageado também nunca sai
// daqui, de propósito (é dado de terceiro que não deu consentimento) —
// e por isso o "título" também não é o gerado pelo Suno: na prática o Suno
// costuma titular a música com o próprio nome do homenageado ("Lucas",
// "Deus", "Messias"...), então usar o title real vazaria o mesmo dado que
// a gente está escondendo. O título público é sempre derivado da ocasião.
export async function GET(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const supabase = createServerClient()
  const { data: orders, error } = await supabase
    .from("orders")
    .select(`id, context, subcategory, musicalStyle, sunoTracks, createdAt, products(${PLAN_FEATURE_COLUMNS})`)
    .eq("publication_consent", true)
    .eq("status", "DELIVERED")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (orders ?? []).map((o) => o.id)
  const { data: gm } = ids.length
    ? await supabase.from("generated_music").select("orderId, slug, mp3Url, lyrics, lyricsLrc").in("orderId", ids)
    : { data: [] }
  const musicByOrder: Record<string, { slug: string | null; mp3Url: string | null; lyrics: string | null; lyricsLrc: string | null }> = {}
  for (const g of gm ?? []) musicByOrder[g.orderId as string] = { slug: g.slug ?? null, mp3Url: g.mp3Url ?? null, lyrics: g.lyrics ?? null, lyricsLrc: g.lyricsLrc ?? null }

  const { data: favs } = await supabase
    .from("catalog_favorites")
    .select("order_id")
    .eq("user_id", user.id)
  const favoriteSet = new Set((favs ?? []).map((f) => f.order_id))

  type Track = { audioUrl: string; imageUrl: string | null; title: string | null }
  const items = (orders ?? [])
    .map((o) => {
      const music = musicByOrder[o.id]
      const tracks = (o.sunoTracks as Track[] | null) ?? []
      const principal = tracks.find((t) => t.audioUrl === music?.mp3Url) ?? tracks[0]
      if (!music?.slug || !principal?.imageUrl || !principal?.audioUrl) return null // sem capa/áudio do Suno, não entra
      const produto = Array.isArray(o.products) ? o.products[0] : o.products
      const features = featuresFromProduct(produto)
      // Mesma trava do player público — sincronizado só se o plano DAQUELE
      // pedido (de quem publicou) incluía o recurso, não do plano de quem ouve.
      const lyrics = features.letraSincronizada
        ? music.lyrics ?? null
        : (music.lyrics?.trim() || (music.lyricsLrc ? lrcToPlainLyrics(music.lyricsLrc) : null))
      const lyricsLrc = features.letraSincronizada ? music.lyricsLrc ?? null : null
      return {
        orderId: o.id,
        slug: music.slug,
        title: `Uma canção de ${o.subcategory}`,
        occasion: o.subcategory,
        musicalStyle: o.musicalStyle ?? null,
        imageUrl: principal.imageUrl,
        audioUrl: principal.audioUrl,
        lyrics,
        lyricsLrc,
        favorited: favoriteSet.has(o.id),
        createdAt: o.createdAt as string,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    // Favoritados sempre primeiro (pedido do Audrei: "se o cliente favoritar
    // tem que manter como as primeiras"); dentro de cada grupo, mais recentes.
    .sort((a, b) => Number(b.favorited) - Number(a.favorited) || +new Date(b.createdAt) - +new Date(a.createdAt))

  return NextResponse.json({ items })
}
