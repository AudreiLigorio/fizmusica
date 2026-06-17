import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const RECENT_MS = 24 * 60 * 60 * 1000 // 24h

async function getUser(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await anon.auth.getUser(token)
  return data.user ?? null
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@")
  if (!domain) return email
  const head = local.slice(0, 1)
  return `${head}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`
}

// GET: verifica se um pedido recente pode ser vinculado à conta logada.
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ status: "unauth" }, { status: 401 })
  const orderId = req.nextUrl.searchParams.get("orderId")
  if (!orderId) return NextResponse.json({ status: "none" })

  const supabase = createServerClient()
  const { data: order } = await supabase
    .from("orders").select("id, email, userId, createdAt").eq("id", orderId).maybeSingle()
  if (!order) return NextResponse.json({ status: "none" })

  const sameEmail = (order.email ?? "").toLowerCase() === (user.email ?? "").toLowerCase()
  if (order.userId === user.id || sameEmail) return NextResponse.json({ status: "already_mine" })

  const recent = Date.now() - new Date(order.createdAt).getTime() < RECENT_MS
  if (order.userId == null && recent) {
    return NextResponse.json({
      status: "linkable",
      code: order.id.slice(0, 8).toUpperCase(),
      maskedEmail: maskEmail(order.email ?? ""),
    })
  }
  return NextResponse.json({ status: "needs_claim" })
}

// POST: vincula o pedido recente à conta e iguala o e-mail (sem verificação,
// pois é o pedido da jornada recém-concluída — a sessão é a prova).
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const { orderId } = await req.json().catch(() => ({}))
  if (!orderId) return NextResponse.json({ error: "Pedido não informado." }, { status: 400 })

  const supabase = createServerClient()
  const { data: order } = await supabase
    .from("orders").select("id, userId, createdAt").eq("id", orderId).maybeSingle()
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })

  const recent = Date.now() - new Date(order.createdAt).getTime() < RECENT_MS
  if (order.userId != null && order.userId !== user.id) {
    return NextResponse.json({ error: "Pedido já vinculado a outra conta." }, { status: 409 })
  }
  if (!recent && order.userId == null) {
    return NextResponse.json({ error: "Pedido antigo — use 'vincular por e-mail'." }, { status: 403 })
  }

  // Vincula e iguala o e-mail ao da conta logada
  await supabase.from("orders")
    .update({ userId: user.id, email: user.email, updatedAt: new Date().toISOString() })
    .eq("id", orderId)

  return NextResponse.json({ ok: true })
}
