import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyAdminToken(token) : false
}

// PATCH: corrige dados de contato do pedido (ex.: e-mail digitado errado).
// Ao corrigir o e-mail, o pedido passa a casar com a conta certa do cliente.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const allowed: Record<string, unknown> = {}
  for (const f of ["email", "nome", "whatsapp"]) if (typeof body[f] === "string") allowed[f] = body[f].trim()

  if (allowed.email && !String(allowed.email).includes("@")) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 })
  }
  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 })
  }

  // Ao trocar o e-mail, solta o vínculo antigo de conta (será revinculado pelo novo e-mail/login)
  if (allowed.email) allowed.userId = null

  const supabase = createServerClient()
  const { error } = await supabase
    .from("orders")
    .update({ ...allowed, updatedAt: new Date().toISOString() })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
