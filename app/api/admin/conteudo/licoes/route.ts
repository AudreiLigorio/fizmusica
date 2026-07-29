import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyAdminToken(token) : false
}

// Lições aprendidas. Como elas passam a valer sem etapa de aprovação, precisam
// ser VISÍVEIS e desativáveis: é a única forma de descobrir qual regra começou
// a estragar as peças.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const supabase = createServerClient()
  const { data } = await supabase
    .from("content_licoes")
    .select("id, regra, feedback_original, ativa, created_at")
    .order("created_at", { ascending: false })
    .limit(60)
  return NextResponse.json({ licoes: data ?? [] })
}

// body: { id, ativa } — liga/desliga uma lição sem apagá-la (dá pra reverter).
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id, ativa } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: "Lição não informada." }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase.from("content_licoes").update({ ativa: !!ativa }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
