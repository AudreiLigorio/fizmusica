import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { createDraft } from "@/lib/content/generate"

export const dynamic = "force-dynamic"
export const maxDuration = 30

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyAdminToken(token) : false
}

// Cria um novo rascunho de conteúdo.
// body: { platform, sourceType: "generico", topic } | { platform, sourceType: "pedido", sourceOrderId }
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { platform, sourceType, topic, sourceOrderId } = body ?? {}

  if (!platform || !["instagram", "tiktok", "youtube"].includes(platform)) {
    return NextResponse.json({ error: "Plataforma inválida." }, { status: 400 })
  }
  if (sourceType !== "generico" && sourceType !== "pedido") {
    return NextResponse.json({ error: "sourceType inválido." }, { status: 400 })
  }
  if (sourceType === "generico" && !topic?.trim()) {
    return NextResponse.json({ error: "Informe o tema." }, { status: 400 })
  }
  if (sourceType === "pedido" && !sourceOrderId) {
    return NextResponse.json({ error: "Informe o pedido de origem." }, { status: 400 })
  }

  const supabase = createServerClient()

  try {
    const draft = sourceType === "generico"
      ? await createDraft(supabase, { platform, sourceType: "generico", topic })
      : await createDraft(supabase, { platform, sourceType: "pedido", sourceOrderId })
    return NextResponse.json({ ok: true, draft })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao gerar rascunho." }, { status: 500 })
  }
}
