import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { sendRevisionRequestedNotification } from "@/app/services/emailService"
import { getComposerSettings } from "@/lib/composer/settings"
import { acceptRevision } from "@/lib/revision"
import { logOrderEvent } from "@/lib/orderEvents"
import { getPlanFeatures } from "@/lib/planFeatures"

export const dynamic = "force-dynamic"

type Params = Promise<{ id: string }>

async function getUserFromAuth(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const supabase = createServerClient()
  const { data } = await supabase
    .from("revision_requests")
    .select("id, status, message, createdAt")
    .eq("orderId", id)
    .maybeSingle()
  return NextResponse.json({ revision: data ?? null })
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { id } = await params
  const { message } = await req.json().catch(() => ({}))
  if (!message?.trim()) return NextResponse.json({ error: "Descreva o que deseja alterar." }, { status: 400 })

  const supabase = createServerClient()

  // Verifica que o pedido pertence ao usuário e está entregue
  const { data: order } = await supabase
    .from("orders")
    .select("id, nome, status, userId, email")
    .eq("id", id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  // Valida posse: userId vinculado ou e-mail do pedido bate com o usuário logado
  const ownsOrder = order.userId === user.id || order.email?.toLowerCase() === user.email?.toLowerCase()
  if (!ownsOrder) return NextResponse.json({ error: "Sem permissão." }, { status: 403 })
  if (order.status !== "DELIVERED") return NextResponse.json({ error: "Pedido não está entregue." }, { status: 400 })

  // Revisão é recurso de plano: sem ela contratada, a solicitação não entra.
  // Barrar aqui (e não só esconder o botão) evita que a revisão seja aceita e
  // duplique o pedido — o que custaria uma geração de música de verdade.
  const features = await getPlanFeatures(supabase, id)
  if (!features.revisao) {
    return NextResponse.json(
      { error: "O plano contratado não inclui revisão da música." },
      { status: 403 },
    )
  }

  // Verifica que não existe contestação anterior
  const { data: existing } = await supabase
    .from("revision_requests")
    .select("id")
    .eq("orderId", id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: "Você já enviou uma solicitação de revisão para este pedido." }, { status: 409 })

  const { data: revision, error } = await supabase
    .from("revision_requests")
    .insert({ orderId: id, message: message.trim() })
    .select("id, status")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logOrderEvent(supabase, id, "revisao_solicitada", message.trim())

  // Original permanece DELIVERED (v1 preservada). O badge no cliente é guiado
  // pela existência da revisão pendente.

  // Modo automático: aceita/duplica o pedido na hora, sem esperar o admin clicar
  // na fila de Produção. A criação da nova música segue o modo de produção normal
  // (auto/review/manual) a partir do momento em que o cliente reaprova a letra.
  const { revisionAutoAccept } = await getComposerSettings()
  let autoAccepted = false
  if (revisionAutoAccept) {
    const result = await acceptRevision(supabase, id, "system")
    autoAccepted = result.ok
    if (!result.ok) console.error("[contestar] aceite automático falhou:", result.error)
  }

  // Alerta o admin — sem isso, a solicitação ficava só no banco e ninguém era avisado.
  await sendRevisionRequestedNotification({ orderId: id, nome: order.nome ?? "Cliente", message: message.trim(), autoAccepted })

  return NextResponse.json({ ok: true, revision })
}
