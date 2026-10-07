import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { extractClientIp } from "@/lib/geoip"
import { logOrderEvent } from "@/lib/orderEvents"
import { rotuloMotivo } from "@/lib/denuncia"
import { tituloNeutro } from "@/lib/tituloPublico"
import { sendMusicReportNotification } from "@/app/services/emailService"

export const dynamic = "force-dynamic"

// Denunciar música da Rede (migração 066). Exigência da Play Store para
// conteúdo gerado por usuário, e vale igual no site.
//
// Funciona SEM conta de propósito: quem ouve pela Rede ou pelo link
// compartilhado nem sempre tem login, e exigir conta para denunciar é o tipo
// de atrito que a política da Play quer evitar. A denúncia NÃO tira a música
// do ar sozinha — senão bastaria um concorrente insistir. Ela avisa o admin,
// que decide no Catálogo.
//
// Contra abuso: o IP entra só como hash (nunca guardamos o IP em si), no
// máximo 5 denúncias por IP a cada 24h, e uma por música.

const LIMITE_DIA = 5

const hashIp = (ip: string) =>
  createHash("sha256")
    .update(`${process.env.PREVIEW_IP_SALT ?? "fizmusica-previa"}:denuncia:${ip}`)
    .digest("hex")

async function getUserId(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await anon.auth.getUser(token)
  return data?.user?.id ?? null
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const orderId = typeof body.orderId === "string" ? body.orderId : ""
  const motivo = typeof body.motivo === "string" ? body.motivo : ""
  const detalhe = typeof body.detalhe === "string" ? body.detalhe.trim().slice(0, 1000) : ""
  const sessao = typeof body.sessao === "string" && body.sessao ? body.sessao.slice(0, 64) : null

  const rotulo = rotuloMotivo(motivo)
  if (!orderId || !rotulo) return NextResponse.json({ error: "Escolha um motivo." }, { status: 400 })
  if (motivo === "outro" && detalhe.length < 5) {
    return NextResponse.json({ error: "Conte em poucas palavras o que há de errado." }, { status: 400 })
  }

  const supabase = createServerClient()

  // Só música que está NA REDE pode ser denunciada — mesma trava do catálogo.
  // Sem isso daria pra encher a caixa do admin com ids de pedidos privados.
  const { data: order } = await supabase
    .from("orders")
    .select("id, subcategory")
    .eq("id", orderId)
    .eq("publication_consent", true)
    .eq("status", "DELIVERED")
    .eq("rede_oculta", false)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: "Música não encontrada." }, { status: 404 })

  const ip = extractClientIp(req.headers)
  const ipHash = ip ? hashIp(ip) : null
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  if (ipHash) {
    const { data: recentes } = await supabase
      .from("music_reports")
      .select("orderId")
      .eq("ip_hash", ipHash)
      .gte("created_at", desde)
    // A mesma pessoa denunciando a mesma música de novo: responde "ok" sem
    // gravar — a denúncia dela já está com o admin, e não há o que corrigir.
    if ((recentes ?? []).some((r) => r.orderId === orderId)) return NextResponse.json({ ok: true })
    if ((recentes ?? []).length >= LIMITE_DIA) {
      return NextResponse.json({ error: "Recebemos várias denúncias suas hoje. Tente novamente amanhã ou escreva para contato@fizmusica.com.br." }, { status: 429 })
    }
  }

  const userId = await getUserId(req)
  const { error } = await supabase.from("music_reports").insert({
    orderId, motivo, detalhe: detalhe || null, sessao, user_id: userId, ip_hash: ipHash,
  })
  if (error) return NextResponse.json({ error: "Não foi possível enviar agora. Tente de novo." }, { status: 500 })

  await logOrderEvent(supabase, orderId, "musica_denunciada", rotulo, userId ? "cliente" : "system")

  const [{ count }, { data: music }] = await Promise.all([
    supabase.from("music_reports").select("id", { count: "exact", head: true }).eq("orderId", orderId).eq("status", "aberta"),
    supabase.from("generated_music").select("musicName").eq("orderId", orderId).maybeSingle(),
  ])
  await sendMusicReportNotification({
    orderId,
    titulo: music?.musicName || tituloNeutro(order.subcategory),
    motivo: rotulo,
    detalhe: detalhe || null,
    totalAbertas: count ?? 1,
  })

  return NextResponse.json({ ok: true })
}
