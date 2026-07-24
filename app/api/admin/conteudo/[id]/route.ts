import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { syncImageTask } from "@/lib/content/generate"
import { publishDraft } from "@/lib/content/publish"
import { logContentEvent } from "@/lib/content/events"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // publicação de Reels espera o processamento do vídeo (polling)

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyAdminToken(token) : false
}

// Estado atual do rascunho (pra tela de qualificação auto-atualizar enquanto a
// imagem gera).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const supabase = createServerClient()
  const { data } = await supabase.from("content_drafts").select("*").eq("id", id).maybeSingle()
  return NextResponse.json(data ?? {})
}

// Ações do admin sobre um rascunho.
// body: { action: "sincronizar" | "aprovar" | "rejeitar" | "publicar", rejectionReason? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const { action, rejectionReason } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  if (action === "sincronizar") {
    try {
      const draft = await syncImageTask(supabase, id)
      return NextResponse.json({ ok: true, draft })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao sincronizar." }, { status: 500 })
    }
  }

  if (action === "aprovar") {
    const { error } = await supabase
      .from("content_drafts")
      .update({ status: "aprovado", reviewed_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logContentEvent(supabase, id, "aprovado", undefined, "admin")
    return NextResponse.json({ ok: true, status: "aprovado" })
  }

  if (action === "rejeitar") {
    const { error } = await supabase
      .from("content_drafts")
      .update({
        status: "rejeitado",
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason ?? null,
      })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logContentEvent(supabase, id, "rejeitado", rejectionReason, "admin")
    return NextResponse.json({ ok: true, status: "rejeitado" })
  }

  if (action === "publicar") {
    try {
      const result = await publishDraft(supabase, id)
      return NextResponse.json({ ok: true, ...result })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao publicar." }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
}
