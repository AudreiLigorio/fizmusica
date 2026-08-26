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
// vazar foto real por engano aqui. Nome do homenageado nunca sai daqui, de
// propósito (é dado de terceiro que não deu consentimento).
//
// Apelido do autor: só sai daqui quando o dono do pedido ligou
// profiles.mostrar_apelido (opt-in separado — publication_consent autoriza
// publicar a música, não expor identidade). Ver migração 052.
//
// Título: usa o real só quando `musicNameConfirmed` — a flag de "liberado pra
// aparecer publicamente", que se ganha de duas formas: (1) o cliente confirmou
// no passo de aprovar a letra, com sugestão que o prompt proíbe de ter nome
// próprio; (2) auditamos e liberamos na mão (backfill de 2026-08-26, 55
// pedidos legados). Sem a flag, cai pro derivado da ocasião — o
// `sunoTracks[].title` costuma ser o nome do homenageado ("Lucas", "Deus") e
// até o musicName antigo da IA já saiu com nome tirado da letra ("A Doce
// Espera de Beatriz", corrigido no backfill).
export async function GET(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const supabase = createServerClient()
  const { data: orders, error } = await supabase
    .from("orders")
    .select(`id, context, subcategory, musicalStyle, sunoTracks, createdAt, userId, products(${PLAN_FEATURE_COLUMNS})`)
    .eq("publication_consent", true)
    .eq("status", "DELIVERED")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Apelido do autor: opt-in separado do publication_consent (que só cobre a
  // música) — mostrar_apelido default false, então maioria dos pedidos não
  // tem dono identificável (userId nulo, checkout sem conta) nem apelido
  // preenchido, e isso é o esperado, não um bug.
  const ownerIds = [...new Set((orders ?? []).map((o) => o.userId).filter(Boolean))] as string[]
  const { data: perfis } = ownerIds.length
    ? await supabase.from("profiles").select("user_id, apelido, mostrar_apelido").in("user_id", ownerIds)
    : { data: [] }
  const apelidoPorUser: Record<string, string> = {}
  for (const p of perfis ?? []) {
    // Nas músicas do próprio cliente o apelido aparece sempre — mostrar_apelido
    // controla o que OUTROS veem, não o que ele vê da própria música.
    const proprio = p.user_id === user.id
    if ((proprio || p.mostrar_apelido) && p.apelido?.trim()) apelidoPorUser[p.user_id as string] = p.apelido.trim()
  }

  const ids = (orders ?? []).map((o) => o.id)
  const { data: gm } = ids.length
    ? await supabase.from("generated_music").select("orderId, slug, mp3Url, lyrics, lyricsLrc, musicName, musicNameConfirmed").in("orderId", ids)
    : { data: [] }
  const musicByOrder: Record<string, { slug: string | null; mp3Url: string | null; lyrics: string | null; lyricsLrc: string | null; musicName: string | null; musicNameConfirmed: boolean }> = {}
  for (const g of gm ?? []) musicByOrder[g.orderId as string] = {
    slug: g.slug ?? null,
    mp3Url: g.mp3Url ?? null,
    lyrics: g.lyrics ?? null,
    lyricsLrc: g.lyricsLrc ?? null,
    musicName: g.musicName ?? null,
    musicNameConfirmed: !!g.musicNameConfirmed,
  }

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
        // Nome real quando o cliente confirmou — ou sempre, se a música é dele
        // (a trava do confirmado existe pra não expor título de terceiro).
        title: music.musicName?.trim() && (music.musicNameConfirmed || o.userId === user.id)
          ? music.musicName.trim()
          : `Uma canção de ${o.subcategory}`,
        occasion: o.subcategory,
        musicalStyle: o.musicalStyle ?? null,
        imageUrl: principal.imageUrl,
        audioUrl: principal.audioUrl,
        lyrics,
        lyricsLrc,
        authorApelido: o.userId ? apelidoPorUser[o.userId as string] ?? null : null,
        favorited: favoriteSet.has(o.id),
        createdAt: o.createdAt as string,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // Favoritados sempre primeiro (pedido do Audrei: "se o cliente favoritar
  // tem que manter como as primeiras"). Dentro de cada grupo, embaralhado —
  // por data sempre soterrava os pedidos antigos conforme o catálogo
  // crescia; embaralhar dá sensação de descoberta de verdade a cada visita.
  function embaralhar<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  const favoritados = embaralhar(items.filter((i) => i.favorited))
  const resto        = embaralhar(items.filter((i) => !i.favorited))

  return NextResponse.json({ items: [...favoritados, ...resto] })
}
