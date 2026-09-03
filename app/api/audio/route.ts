import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { urlAssinadaDoAudio } from "@/lib/audioUrl"

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

// Porta única do áudio.
//
// Antes o MP3 morava num bucket PÚBLICO e o endereço era permanente: a
// resposta de /api/catalog entregava o link do arquivo, inclusive pra
// visitante anônimo. Auditoria de 2026-08-28: baixei uma música da Rede
// inteira (4,4 MB) com dois comandos, sem conta.
//
// Agora nenhuma resposta da API devolve link de arquivo — devolve o endereço
// DESTA rota. Aqui se verifica QUEM pode ouvir O QUÊ e só então se assina uma
// URL temporária, pra qual o navegador é redirecionado. O link que aparece no
// inspetor expira; copiar e colar deixa de funcionar em minutos.
//
// Redireciona em vez de repassar os bytes de propósito: repassar faria cada
// play consumir 4 MB de banda da nossa função e jogaria fora o CDN — logo
// depois do trabalho de performance que derrubou o payload pra 23 KB.
//
// NÃO é bloqueio absoluto — quem ouve pode gravar o áudio, isso vale pra
// qualquer player do mundo. O que muda é a barreira: sai de "dois comandos
// que qualquer um roda" pra "precisa de trabalho manual, música por música".
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const slug = sp.get("slug")?.trim() || null
  const orderId = sp.get("o")?.trim() || null
  const audioId = sp.get("t")?.trim() || null

  const supabase = createServerClient()

  // ── Caminho 1: player público /m/[slug] ───────────────────────────────
  // O slug É a credencial (é o link que o próprio cliente compartilha, e o
  // termo diz que a divulgação é controlada por ele). Link expirado pelo
  // expurgo não toca mais.
  if (slug) {
    const { data } = await supabase
      .from("generated_music")
      .select("mp3Url, link_disabled_at")
      .eq("slug", slug)
      .maybeSingle()
    if (!data?.mp3Url || data.link_disabled_at) return negar()
    return redirecionar(await urlAssinadaDoAudio(supabase, data.mp3Url))
  }

  if (!orderId) return negar()

  // As duas consultas em PARALELO. Eram sequenciais e cada uma custa ~300ms
  // (medido) — em série, meio segundo antes de sequer começar a assinar. A
  // de generated_music não depende do resultado da de orders: se a
  // autorização falhar, o resultado dela é simplesmente descartado.
  const [{ data: order }, { data: gm }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, userId, status, publication_consent, sunoTracks")
      .eq("id", orderId)
      .maybeSingle(),
    supabase
      .from("generated_music").select("mp3Url").eq("orderId", orderId).maybeSingle(),
  ])
  if (!order) return negar()

  // ── Caminho 2: música da Rede ─────────────────────────────────────────
  // Mesma regra do catálogo: entregue e com autorização de publicação. Quem
  // aparece na Rede pode ser ouvido por qualquer visitante — é o que a tela
  // já oferece hoje.
  const naRede = order.status === "DELIVERED" && order.publication_consent === true

  // ── Caminho 3: o dono ─────────────────────────────────────────────────
  // Música não publicada só toca pra quem é dono dela.
  const user = naRede ? null : await getUserFromAuth(req)
  const dono = !!user && !!order.userId && order.userId === user.id
  if (!naRede && !dono) return negar()

  // Faixa específica (o cliente recebe 2 versões do Suno) ou a principal.
  type Track = { audioId?: string; audioUrl?: string }
  const tracks = (order.sunoTracks as Track[] | null) ?? []
  const alvo = audioId
    ? tracks.find((t) => t.audioId === audioId)?.audioUrl ?? null
    : (gm?.mp3Url ?? tracks[0]?.audioUrl ?? null)
  if (!alvo) return negar()

  return redirecionar(await urlAssinadaDoAudio(supabase, alvo))
}

// Resposta igual pra "não existe" e "não pode": responder diferente diria a
// quem sondasse quais pedidos existem no banco.
function negar() {
  return NextResponse.json({ error: "Áudio indisponível." }, { status: 404 })
}

function redirecionar(url: string | null) {
  if (!url) return negar()
  // 302, não 301: a URL assinada muda a cada pedido, então esta resposta
  // nunca pode ser guardada como permanente.
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  })
}
