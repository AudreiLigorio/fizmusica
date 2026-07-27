import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { createDraft } from "@/lib/content/generate"
import { getContentSettings, decidirPauta } from "@/lib/content/cmo"
import { publishDraft } from "@/lib/content/publish"
import { logContentEvent } from "@/lib/content/events"

export const dynamic = "force-dynamic"
// CMO (1 chamada) + roteirista (2 a 4) + imagem + eventual publicação.
export const maxDuration = 300

// Esteira de conteúdo. Roda todo dia pela Vercel; quem decide se HOJE é dia de
// produzir é a parametrização em content_settings, não o cron — assim o admin
// muda o cronograma pelo painel, sem deploy.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const supabase = createServerClient()
  const settings = await getContentSettings(supabase)

  if (settings.modo === "manual") {
    return NextResponse.json({ ok: true, pulou: "modo manual" })
  }

  // Dia da semana no fuso de São Paulo — senão a virada do dia em UTC
  // desalinha o cronograma (à noite no Brasil já é o dia seguinte em UTC).
  const agoraSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
  const diaSemana = agoraSP.getDay()
  if (!settings.dias_semana.includes(diaSemana)) {
    return NextResponse.json({ ok: true, pulou: `hoje (${diaSemana}) não está no cronograma` })
  }

  // Trava de volume: vale pra qualquer modo, porque o custo (Gemini + KIE) é
  // real e um bug em loop sairia caro antes de alguém perceber.
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from("content_drafts")
    .select("id", { count: "exact", head: true })
    .eq("origem_automatica", true)
    .gte("created_at", seteDiasAtras)
  if ((count ?? 0) >= settings.teto_semanal) {
    return NextResponse.json({ ok: true, pulou: `teto semanal atingido (${count}/${settings.teto_semanal})` })
  }

  try {
    const briefing = await decidirPauta(supabase, settings.plataformas)

    const draft = await createDraft(supabase, {
      platform: briefing.plataforma,
      sourceType: "generico",
      topic: `${briefing.tema} — ângulo: ${briefing.angulo}`,
    })

    await supabase
      .from("content_drafts")
      .update({ origem_automatica: true, cmo_briefing: briefing })
      .eq("id", draft.id)

    await logContentEvent(supabase, draft.id, "rascunho_criado", `CMO: ${briefing.justificativa}`, "system")

    if (settings.modo === "semi") {
      return NextResponse.json({ ok: true, draftId: draft.id, briefing, publicado: false, motivo: "modo semi — aguardando aprovação" })
    }

    // ---- modo automático: as travas decidem se publica sozinho ----
    const bloqueios: string[] = []
    const nota = Number(draft.quality_score ?? 0)
    if (draft.needs_human) bloqueios.push("reprovado no crivo")
    if (nota < settings.nota_minima_auto) bloqueios.push(`nota ${nota} abaixo de ${settings.nota_minima_auto}`)
    if (settings.luto_sempre_manual && /luto|despedida|póstuma|postuma|falecid|saudade de quem partiu/i.test(
      `${draft.persona ?? ""} ${draft.emocao_alvo ?? ""} ${draft.topic ?? ""}`)) {
      bloqueios.push("tema de luto exige aprovação humana")
    }
    if (settings.pedido_real_manual && draft.source_type === "pedido") {
      bloqueios.push("peça de história real exige aprovação humana")
    }

    if (bloqueios.length) {
      await logContentEvent(supabase, draft.id, "rascunho_criado", `publicação automática barrada: ${bloqueios.join("; ")}`, "system")
      return NextResponse.json({ ok: true, draftId: draft.id, briefing, publicado: false, bloqueios })
    }

    await supabase.from("content_drafts").update({ status: "aprovado", reviewed_at: new Date().toISOString() }).eq("id", draft.id)
    const resultado = await publishDraft(supabase, draft.id)
    return NextResponse.json({ ok: true, draftId: draft.id, briefing, publicado: true, resultado })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha na esteira de conteúdo."
    console.error("[cron/conteudo]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
