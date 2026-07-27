import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { getContentSettings } from "@/lib/content/cmo"

export const dynamic = "force-dynamic"

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyAdminToken(token) : false
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const supabase = createServerClient()
  return NextResponse.json(await getContentSettings(supabase))
}

// Parametrização da esteira. Só aceita os campos conhecidos — nada de repassar
// o body cru pro banco.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.modo !== undefined) {
    if (!["manual", "semi", "auto"].includes(body.modo)) {
      return NextResponse.json({ error: "Modo inválido." }, { status: 400 })
    }
    patch.modo = body.modo
  }
  if (Array.isArray(body.dias_semana)) {
    const dias = body.dias_semana.map(Number).filter((d: number) => d >= 0 && d <= 6)
    patch.dias_semana = Array.from(new Set(dias)).sort()
  }
  if (Array.isArray(body.plataformas)) {
    const validas = body.plataformas.filter((p: string) => ["instagram", "tiktok", "youtube"].includes(p))
    if (!validas.length) return NextResponse.json({ error: "Escolha ao menos uma plataforma." }, { status: 400 })
    patch.plataformas = validas
  }
  if (body.nota_minima_auto !== undefined) {
    const n = Number(body.nota_minima_auto)
    if (Number.isNaN(n) || n < 0 || n > 10) return NextResponse.json({ error: "Nota mínima inválida." }, { status: 400 })
    patch.nota_minima_auto = n
  }
  if (body.teto_semanal !== undefined) {
    const n = Number(body.teto_semanal)
    if (Number.isNaN(n) || n < 1 || n > 50) return NextResponse.json({ error: "Teto semanal inválido." }, { status: 400 })
    patch.teto_semanal = n
  }
  if (body.luto_sempre_manual !== undefined) patch.luto_sempre_manual = !!body.luto_sempre_manual
  if (body.pedido_real_manual !== undefined) patch.pedido_real_manual = !!body.pedido_real_manual

  const supabase = createServerClient()
  const { error } = await supabase.from("content_settings").update(patch).eq("id", 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, settings: await getContentSettings(supabase) })
}
