import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { sendClaimConfirmationEmail } from "@/app/services/emailService"

export const dynamic = "force-dynamic"

// Valida o token de sessão (JWT) do Supabase e devolve o usuário logado
async function getUserFromAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { code, purchaseEmail } = await req.json().catch(() => ({}))
  const cleanCode = String(code ?? "").trim().replace(/^#/, "").toLowerCase()
  const cleanEmail = String(purchaseEmail ?? "").trim().toLowerCase()
  if (cleanCode.length < 4 || !cleanEmail.includes("@")) {
    return NextResponse.json({ error: "Informe o código do pedido e o e-mail da compra." }, { status: 400 })
  }

  const supabase = createServerClient()

  // Acha o pedido pelo prefixo do id (código) + e-mail da compra
  const { data: orders } = await supabase
    .from("orders")
    .select("id, email, userId")
    .ilike("id", `${cleanCode}%`)
    .ilike("email", cleanEmail)

  const order = orders?.[0]
  if (!order) {
    return NextResponse.json({ error: "Nenhum pedido encontrado com esse código e e-mail." }, { status: 404 })
  }
  if (order.userId === user.id) {
    return NextResponse.json({ error: "Este pedido já está na sua conta." }, { status: 409 })
  }

  // Cria a reivindicação (token de confirmação)
  const { data: claim, error: claimErr } = await supabase
    .from("order_claims")
    .insert({ orderId: order.id, userId: user.id, email: order.email })
    .select("token")
    .single()

  if (claimErr || !claim) {
    return NextResponse.json({ error: "Falha ao iniciar a vinculação." }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"
  const confirmUrl = `${baseUrl}/api/conta/claim/confirm?token=${claim.token}`
  const code8 = order.id.slice(0, 8).toUpperCase()

  const r = await sendClaimConfirmationEmail({ email: order.email, code: code8, confirmUrl })
  if (!r.ok) return NextResponse.json({ error: "Não foi possível enviar o e-mail de confirmação." }, { status: 500 })

  return NextResponse.json({ ok: true, sentTo: order.email })
}
