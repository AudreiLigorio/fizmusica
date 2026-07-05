import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { logOrderEvent } from "@/lib/orderEvents"

export const dynamic = "force-dynamic"

type Params = Promise<{ id: string }>

const TERM_VERSION = "entrega-digital-2026-06"

async function getUserFromAuth(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { id } = await params
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id, userId, email, status")
    .eq("id", id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  const owns = order.userId === user.id || order.email?.toLowerCase() === user.email?.toLowerCase()
  if (!owns) return NextResponse.json({ error: "Sem permissão." }, { status: 403 })

  const { error } = await supabase
    .from("orders")
    .update({
      sharing_term_accepted_at: new Date().toISOString(),
      sharing_term_version: TERM_VERSION,
    })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logOrderEvent(supabase, id, "termo_entrega_aceito")
  return NextResponse.json({ ok: true })
}
