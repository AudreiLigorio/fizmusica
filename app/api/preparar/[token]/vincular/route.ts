import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

async function getUser(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await anon.auth.getUser(token)
  return data.user ?? null
}

// "Salvar meu acesso": vincula o pedido do photo_token à conta logada.
// O token é a prova de posse (mais forte que a janela de 24h do link-order),
// então não há restrição de idade do pedido. Diferente do link-order, NÃO
// sobrescreve o e-mail do pedido — os avisos continuam indo pro e-mail da
// compra; a conta só ganha o pedido na listagem (via userId).
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 400 })

  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const supabase = createServerClient()
  const { data: order } = await supabase
    .from("orders").select("id, userId").eq("photo_token", token).maybeSingle()
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })

  if (order.userId === user.id) return NextResponse.json({ ok: true, already: true })
  if (order.userId != null) {
    return NextResponse.json({ error: "Este pedido já está salvo em outra conta." }, { status: 409 })
  }

  const { error } = await supabase.from("orders")
    .update({ userId: user.id, updatedAt: new Date().toISOString() })
    .eq("id", order.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
