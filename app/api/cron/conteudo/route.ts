import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { rodarEsteira } from "@/lib/content/esteira"

export const dynamic = "force-dynamic"
// CMO (1 chamada) + roteirista (2 a 4) + imagem + eventual publicação.
export const maxDuration = 300

// Esteira de conteúdo. Roda todo dia pela Vercel; quem decide se HOJE é dia de
// produzir é a parametrização em content_settings, não o cron — assim o admin
// muda o cronograma pelo painel, sem deploy. A lógica mora em
// lib/content/esteira.ts, compartilhada com o botão "rodar agora".
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const resultado = await rodarEsteira(createServerClient())
    return NextResponse.json(resultado)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha na esteira de conteúdo."
    console.error("[cron/conteudo]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
