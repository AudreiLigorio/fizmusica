import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { syncImageTask, runGeneration } from "@/lib/content/generate"
import { publishDraft } from "@/lib/content/publish"
import { logContentEvent } from "@/lib/content/events"
import { purgeDraftMedia } from "@/lib/content/media"

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
// body: { action: "sincronizar" | "editar" | "regerar" | "aprovar" | "rejeitar" | "publicar" | "apagar_midia", rejectionReason?, caption?, hashtags? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const { action, rejectionReason, caption, hashtags } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  if (action === "sincronizar") {
    try {
      const draft = await syncImageTask(supabase, id)
      return NextResponse.json({ ok: true, draft })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao sincronizar." }, { status: 500 })
    }
  }

  // Refaz a geração de um rascunho que falhou (ou que ficou preso em
  // "gerando" porque a função morreu no meio). Reaproveita a mesma linha.
  if (action === "regerar") {
    try {
      const draft = await runGeneration(supabase, id)
      return NextResponse.json({ ok: true, draft })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao regerar." }, { status: 500 })
    }
  }

  // Correção de texto sem perder a mídia. Legenda e hashtags são publicadas
  // como texto do post — não estão dentro da imagem —, então dá pra ajustar à
  // vontade sem regerar nada. (O gancho é diferente: ele é queimado na imagem
  // final, e mudá-lo exigiria uma imagem nova.)
  if (action === "editar") {
    if (typeof caption !== "string" || !caption.trim()) {
      return NextResponse.json({ error: "A legenda não pode ficar vazia." }, { status: 400 })
    }
    const { error } = await supabase
      .from("content_drafts")
      .update({ caption: caption.trim(), hashtags: typeof hashtags === "string" ? hashtags.trim() : undefined })
      .eq("id", id)
      .is("published_at", null) // peça já publicada não se reescreve: o post lá fora não muda junto
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logContentEvent(supabase, id, "rascunho_criado", "texto editado pelo admin", "admin")
    return NextResponse.json({ ok: true })
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

    // Mídia de peça rejeitada não serve pra nada: sai na hora, antes de virar
    // peso no bucket. Falha aqui não impede a rejeição.
    const purge = await purgeDraftMedia(supabase, id)
    if (purge.arquivos > 0) {
      await logContentEvent(supabase, id, "rejeitado", `mídia descartada (${purge.arquivos} arquivo(s))`, "system")
    }
    return NextResponse.json({ ok: true, status: "rejeitado", midiaApagada: purge.arquivos })
  }

  // Exclusão manual — pra peça aprovada/publicada que já cumpriu seu papel.
  // Os textos e o registro da publicação ficam; some só o peso.
  if (action === "apagar_midia") {
    const { arquivos, erro } = await purgeDraftMedia(supabase, id)
    if (erro) return NextResponse.json({ error: erro }, { status: 500 })
    await logContentEvent(supabase, id, "rascunho_criado", `mídia apagada manualmente (${arquivos} arquivo(s))`, "admin")
    return NextResponse.json({ ok: true, midiaApagada: arquivos })
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
