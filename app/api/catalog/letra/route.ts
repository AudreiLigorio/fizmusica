import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { PLAN_FEATURE_COLUMNS, featuresFromProduct } from "@/lib/planFeatures"
import { lrcToPlainLyrics } from "@/lib/suno/lrc"

export const dynamic = "force-dynamic"

// Letra de UMA música da Rede, buscada só quando o player vai tocar.
//
// Existe porque a letra saiu da listagem: medido, `lyrics` + `lyricsLrc` eram
// 76% do payload de /api/catalog (114 KB de 150 KB para 68 músicas) e a lista
// não usa letra nenhuma — só o player, e só da faixa que está tocando. Na
// projeção de 5.000 músicas isso é a diferença entre ~9,7 MB e ~2,5 MB por
// requisição.
//
// A trava de publicação é a MESMA da listagem, repetida aqui de propósito:
// esta rota é acessível direto por URL, então não pode confiar em ter vindo
// da tela. Só devolve letra de pedido ENTREGUE e com autorização de
// publicação — sem isso, dava pra ler a letra de qualquer pedido sabendo o id.
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim()
  if (!orderId) return NextResponse.json({ error: "orderId obrigatório." }, { status: 400 })

  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select(`id, products(${PLAN_FEATURE_COLUMNS})`)
    .eq("id", orderId)
    .eq("publication_consent", true)
    .eq("status", "DELIVERED")
    .maybeSingle()

  // Resposta igual pra "não existe" e "não pode": responder diferente diria a
  // quem sondasse quais ids existem no banco.
  if (!order) return NextResponse.json({ lyrics: null, lyricsLrc: null })

  const { data: music } = await supabase
    .from("generated_music")
    .select("lyrics, lyricsLrc")
    .eq("orderId", orderId)
    .maybeSingle()

  if (!music) return NextResponse.json({ lyrics: null, lyricsLrc: null })

  const produto = Array.isArray(order.products) ? order.products[0] : order.products
  const features = featuresFromProduct(produto)

  // Mesma trava do player público — sincronizado só se o plano DAQUELE pedido
  // (de quem publicou) incluía o recurso, não do plano de quem ouve.
  const lyrics = features.letraSincronizada
    ? music.lyrics ?? null
    : (music.lyrics?.trim() || (music.lyricsLrc ? lrcToPlainLyrics(music.lyricsLrc) : null))
  const lyricsLrc = features.letraSincronizada ? music.lyricsLrc ?? null : null

  return NextResponse.json(
    { lyrics, lyricsLrc },
    // Letra de música publicada não muda e é a mesma pra todo mundo (a trava
    // depende do plano de QUEM PUBLICOU, não de quem ouve) — pode cachear.
    { headers: { "Cache-Control": "public, max-age=3600" } },
  )
}
