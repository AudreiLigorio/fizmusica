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

  const { purchaseEmail } = await req.json().catch(() => ({}))
  const cleanEmail = String(purchaseEmail ?? "").trim().toLowerCase()
  if (!cleanEmail.includes("@")) {
    return NextResponse.json({ error: "Informe o e-mail usado na compra." }, { status: 400 })
  }

  const supabase = createServerClient()

  // Acha pedidos pelo e-mail da compra que ainda não são desta conta
  const { data: orders } = await supabase
    .from("orders")
    .select("id, email, userId")
    .ilike("email", cleanEmail)

  const claimable = (orders ?? []).filter((o) => o.userId !== user.id)
  if (claimable.length === 0) {
    return NextResponse.json({ error: "Nenhum pedido encontrado com esse e-mail (ou já estão na sua conta)." }, { status: 404 })
  }

  // Cria a reivindicação por e-mail (ao confirmar, vincula todos os pedidos desse e-mail)
  const { data: claim, error: claimErr } = await supabase
    .from("order_claims")
    .insert({ orderId: claimable[0].id, userId: user.id, email: cleanEmail })
    .select("token")
    .single()

  if (claimErr || !claim) {
    return NextResponse.json({ error: "Falha ao iniciar a vinculação." }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"
  const confirmUrl = `${baseUrl}/api/conta/claim/confirm?token=${claim.token}`

  const r = await sendClaimConfirmationEmail({
    email: cleanEmail,
    code: `${claimable.length} pedido${claimable.length !== 1 ? "s" : ""}`,
    confirmUrl,
  })
  if (!r.ok) return NextResponse.json({ error: "Não foi possível enviar o e-mail de confirmação." }, { status: 500 })

  return NextResponse.json({ ok: true, sentTo: cleanEmail })
}
