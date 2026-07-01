import { NextRequest, NextResponse, after } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { ingestSunoResult } from "@/lib/suno/ingest"
import { handleSunoFailure } from "@/lib/suno/failure"

export const dynamic = "force-dynamic"

// Webhook do KIE/Suno: chamado quando a geração termina (callbackType "complete").
// Exige resposta 200 rápida (timeout 15s, 3 retries) → respondemos na hora e
// processamos o resultado em background com after().
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  const code = body.code
  const callbackType = body.callbackType ?? body.data?.callbackType
  const taskId = body.task_id ?? body.data?.task_id ?? body.taskId

  if (!taskId) return NextResponse.json({ ok: true })

  // Só agimos no estágio final ("complete"); ignoramos "text"/"first".
  if (callbackType && callbackType !== "complete" && callbackType !== "error") {
    return NextResponse.json({ ok: true })
  }

  after(async () => {
    const supabase = createServerClient()

    const { data: order } = await supabase
      .from("orders")
      .select("id, honoreeName, nome, lyricsDraft")
      .eq("sunoTaskId", taskId)
      .maybeSingle()
    if (!order) { console.error("[suno/callback] pedido não encontrado p/ task", taskId); return }

    if (code === 501 || callbackType === "error") {
      await handleSunoFailure(supabase, order.id, taskId)
      return
    }

    const rawTracks: any[] = body.data?.data ?? body.data ?? []
    // Sem faixas: consulta o KIE p/ o motivo real e tenta auto-retry (ex.: palavra sensível).
    if (!Array.isArray(rawTracks) || rawTracks.length === 0) {
      await handleSunoFailure(supabase, order.id, taskId)
      return
    }
    await ingestSunoResult(supabase, order, taskId, rawTracks)
  })

  return NextResponse.json({ ok: true })
}
