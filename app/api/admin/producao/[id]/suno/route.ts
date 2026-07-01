import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { triggerSunoGeneration } from "@/lib/suno/trigger"
import { getMusicDetails } from "@/lib/suno/client"
import { ingestSunoResult } from "@/lib/suno/ingest"
import { handleSunoFailure } from "@/lib/suno/failure"
import { notifyMusicReady } from "@/lib/suno/notify"

export const dynamic = "force-dynamic"
export const maxDuration = 30

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyAdminToken(token) : false
}

// Estado atual da geração (para o painel auto-atualizar enquanto gera).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const supabase = createServerClient()
  const { data } = await supabase
    .from("orders").select("sunoStatus, sunoTracks, sunoError").eq("id", id).single()
  return NextResponse.json(data ?? {})
}

// Ações do admin sobre a geração Suno.
// body: { action: "gerar" | "regenerar" | "liberar" | "sincronizar" }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const { action } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id, paymentStatus, lyricsApproved, lyricsDraft, musicalStyle, voiceType, emotion, honoreeName, nome, subcategory, sunoStatus, sunoTracks, sunoTaskId, revision_note")
    .eq("id", id)
    .single()

  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })

  // Liberar as versões para o cliente escolher
  if (action === "liberar") {
    const tracks = Array.isArray(order.sunoTracks) ? order.sunoTracks : []
    if (order.sunoStatus !== "READY" || tracks.length === 0) {
      return NextResponse.json({ error: "Não há versões prontas para liberar." }, { status: 409 })
    }
    const { error } = await supabase.from("orders").update({ sunoStatus: "RELEASED" }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await notifyMusicReady(supabase, id)
    return NextResponse.json({ ok: true, status: "RELEASED" })
  }

  // Gerar / Regenerar
  if (action === "gerar" || action === "regenerar") {
    if (order.paymentStatus !== "PAID" || !order.lyricsApproved || !order.lyricsDraft?.trim()) {
      return NextResponse.json({ error: "Pedido precisa estar pago e com letra aprovada." }, { status: 409 })
    }
    try {
      const taskId = await triggerSunoGeneration(supabase, order)
      return NextResponse.json({ ok: true, status: "GENERATING", taskId })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao gerar." }, { status: 500 })
    }
  }

  // Sincronizar: fallback caso o webhook não tenha chegado — consulta o KIE e processa.
  if (action === "sincronizar") {
    if (!order.sunoTaskId) return NextResponse.json({ status: order.sunoStatus ?? null })
    // Só faz sentido sincronizar enquanto está gerando.
    if (order.sunoStatus !== "GENERATING") return NextResponse.json({ status: order.sunoStatus })
    try {
      const d = await getMusicDetails(order.sunoTaskId)
      const st = d?.data?.status
      if (st === "SUCCESS") {
        const rawTracks = d?.data?.response?.sunoData ?? []
        const r = await ingestSunoResult(supabase, order, order.sunoTaskId, rawTracks)
        return NextResponse.json({ status: r.status })
      }
      if (st && /FAIL|ERROR|SENSITIVE/i.test(st)) {
        // Grava o motivo real e tenta auto-retry (ex.: palavra sensível/artista nas tags).
        await handleSunoFailure(supabase, id, order.sunoTaskId)
        const { data: cur } = await supabase.from("orders").select("sunoStatus").eq("id", id).single()
        return NextResponse.json({ status: cur?.sunoStatus ?? "FAILED" })
      }
      return NextResponse.json({ status: "GENERATING" })
    } catch {
      return NextResponse.json({ status: "GENERATING" })
    }
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
}
