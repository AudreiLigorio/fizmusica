import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"

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

// Consentimento OPCIONAL de divulgação da obra (música + letra) pela Fiz Música.
// Opt-in livre, revogável. Não cobre identidade de quem encomendou (não divulgada).
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { id } = await params
  const { consent } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id, userId, email")
    .eq("id", id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  const owns = order.userId === user.id || order.email?.toLowerCase() === user.email?.toLowerCase()
  if (!owns) return NextResponse.json({ error: "Sem permissão." }, { status: 403 })

  const { error } = await supabase
    .from("orders")
    .update({
      publication_consent: !!consent,
      publication_consent_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, consent: !!consent })
}
