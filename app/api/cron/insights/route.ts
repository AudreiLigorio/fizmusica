import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { coletarTudo } from "@/lib/content/insights"
import { responderComentariosPendentes } from "@/lib/content/auto-resposta"

export const dynamic = "force-dynamic"
export const maxDuration = 120

// Coleta diária de métricas e comentários do Instagram. Roda cedo pra pegar o
// número do dia anterior já consolidado. Nunca falha ruidosamente: métrica
// ausente é menos grave que cron vermelho todo dia.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const r = await coletarTudo(supabase)
    // Responder vem DEPOIS de coletar: o comentário precisa existir no banco
    // pra ser respondido uma vez só.
    const respostas = await responderComentariosPendentes(supabase)
    return NextResponse.json({ ok: true, ...r, respostas })
  } catch (e) {
    console.error("[cron/insights]", e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "falhou" })
  }
}
