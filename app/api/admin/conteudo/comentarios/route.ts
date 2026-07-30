import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

// Marca um comentário como respondido. A resposta em si é feita por você, no
// Instagram: resposta automática em post emocional queima a marca.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }
  const { id, respondido } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: "Comentário não informado." }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase.from("content_comments").update({ respondido: !!respondido }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
