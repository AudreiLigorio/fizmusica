import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { tituloNeutro } from "@/lib/tituloPublico"

export const dynamic = "force-dynamic"

// "Minhas músicas publicadas" (aba Músicas, só logado): situação de cada
// música entregue do cliente na Rede e o desempenho dela.
//
// Rankings, sempre entre as músicas que ESTÃO na Rede (consent + entregue +
// não oculta — a mesma trava do catálogo):
//   - reproduções: posição pelo total de sempre;
//   - Top 10: a MESMA ordem do Top 10 da Rede (app/api/catalog): reproduções
//     dos últimos 30 dias, total como desempate, quem tem zero fica fora.
//     Duas definições do mesmo ranking divergiriam — se mudar lá, mudar aqui.
// Posição com empate = 1 + quantas estão estritamente na frente.
//
// O Top 10 que a Rede mostra pra ESTE cliente esconde as músicas dele
// (`deOutros` no catálogo). A posição daqui é a que os OUTROS veem.

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await anon.auth.getUser(token)
  return data?.user ?? null
}

type Track = { audioUrl: string; imageUrl: string | null }

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 })

  const supabase = createServerClient()

  // Músicas do cliente: mesmo critério de dono do /api/orders (conta OU
  // e-mail da conta), só entregues.
  const dono = [user.email ? `email.eq.${user.email}` : null, `userId.eq.${user.id}`].filter(Boolean).join(",")
  const { data: minhas, error } = await supabase
    .from("orders")
    .select("id, subcategory, sunoTracks, publication_consent, rede_oculta, createdAt")
    .or(dono)
    .eq("status", "DELIVERED")
    .order("createdAt", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!minhas?.length) return NextResponse.json({ musicas: [], totalNaRede: 0 })

  const ids = minhas.map((o) => o.id)
  const [{ data: gm }, { data: naRede }, { data: plays }, { data: aplausos }] = await Promise.all([
    supabase.from("generated_music").select("orderId, musicName, mp3Url").in("orderId", ids),
    supabase.from("orders").select("id")
      .eq("publication_consent", true).eq("status", "DELIVERED").eq("rede_oculta", false)
      .range(0, 9999),
    supabase.rpc("contagem_plays"),
    supabase.rpc("contagem_aplausos"),
  ])

  const playsPor = new Map<string, { total: number; recentes: number }>()
  for (const p of (plays as { orderId: string; total: number; recentes: number }[] | null) ?? []) {
    playsPor.set(p.orderId, { total: Number(p.total) || 0, recentes: Number(p.recentes) || 0 })
  }
  const palmasPor = new Map<string, number>()
  for (const a of (aplausos as { orderId: string; total: number }[] | null) ?? []) {
    palmasPor.set(a.orderId, Number(a.total) || 0)
  }

  const rede = (naRede ?? []).map((o) => ({
    id: o.id as string,
    total: playsPor.get(o.id)?.total ?? 0,
    recentes: playsPor.get(o.id)?.recentes ?? 0,
  }))
  const comPlay = rede.filter((r) => r.total > 0)
  // Ordem do Top 10 (igual ao catálogo).
  const ordemTop = [...comPlay].sort((a, b) => b.recentes - a.recentes || b.total - a.total)
  const decimo = ordemTop[9]

  const musicaPor = new Map((gm ?? []).map((g) => [g.orderId as string, g]))

  const musicas = minhas.map((o) => {
    const g = musicaPor.get(o.id)
    const tracks = (o.sunoTracks as Track[] | null) ?? []
    const principal = tracks.find((t) => t.audioUrl === g?.mp3Url) ?? tracks[0]
    const situacao = o.rede_oculta ? "oculta" : o.publication_consent ? "publicada" : "privada"
    const p = playsPor.get(o.id) ?? { total: 0, recentes: 0 }

    let posReproducoes: number | null = null
    let posTop: number | null = null
    let faltamParaTop10: number | null = null
    if (situacao === "publicada" && p.total > 0) {
      posReproducoes = 1 + comPlay.filter((r) => r.total > p.total).length
      posTop = 1 + ordemTop.filter((r) => r.recentes > p.recentes || (r.recentes === p.recentes && r.total > p.total)).length
      // Quanto falta (reproduções no mês) pra passar o 10º colocado.
      if (posTop > 10 && decimo) faltamParaTop10 = Math.max(1, decimo.recentes - p.recentes + 1)
    }

    return {
      orderId: o.id,
      // O dono vê o nome real da música (é dele); sem nome, o rótulo neutro.
      titulo: g?.musicName || tituloNeutro(o.subcategory),
      imageUrl: principal?.imageUrl ?? null,
      situacao,
      palmas: palmasPor.get(o.id) ?? 0,
      reproducoes: p.total,
      reproducoesMes: p.recentes,
      posReproducoes,
      posTop,
      faltamParaTop10,
    }
  })

  return NextResponse.json({ musicas, totalNaRede: rede.length, totalComReproducao: comPlay.length })
}
