import type { createServerClient } from "@/lib/supabase"
import { createDraft } from "@/lib/content/generate"
import { getContentSettings, decidirPauta, type Briefing } from "@/lib/content/cmo"
import { publishDraft } from "@/lib/content/publish"
import { logContentEvent } from "@/lib/content/events"

type DB = ReturnType<typeof createServerClient>

// Uma execução da esteira: CMO decide a pauta → roteirista escreve → imagem →
// (no modo auto, se as travas deixarem) publica. Mora aqui, e não na rota do
// cron, porque dois gatilhos chamam a mesma coisa: o agendamento diário e o
// botão "rodar agora" do painel.

export type ResultadoEsteira = {
  ok: boolean
  pulou?: string
  draftId?: string
  briefing?: Briefing
  publicado?: boolean
  bloqueios?: string[]
}

export async function rodarEsteira(
  supabase: DB,
  opts: { ignorarCronograma?: boolean } = {},
): Promise<ResultadoEsteira> {
  const settings = await getContentSettings(supabase)

  if (settings.modo === "manual" && !opts.ignorarCronograma) {
    return { ok: true, pulou: "modo manual" }
  }

  if (!opts.ignorarCronograma) {
    // Dia da semana no fuso de São Paulo — em UTC a noite brasileira já é o
    // dia seguinte, o que desalinharia o cronograma.
    const agoraSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
    const diaSemana = agoraSP.getDay()
    if (!settings.dias_semana.includes(diaSemana)) {
      return { ok: true, pulou: `hoje (${diaSemana}) não está no cronograma` }
    }
  }

  // Teto de volume: vale em qualquer modo e também no disparo manual, porque
  // o custo (Gemini + KIE) é real e um loop sairia caro antes de alguém ver.
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from("content_drafts")
    .select("id", { count: "exact", head: true })
    .eq("origem_automatica", true)
    .gte("created_at", seteDiasAtras)
  if ((count ?? 0) >= settings.teto_semanal) {
    return { ok: true, pulou: `teto semanal atingido (${count}/${settings.teto_semanal})` }
  }

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

  if (settings.modo !== "auto") {
    return { ok: true, draftId: draft.id, briefing, publicado: false, bloqueios: ["aguardando aprovação (modo não automático)"] }
  }

  // ---- modo automático: as travas decidem se a peça vai sozinha ----
  const bloqueios: string[] = []
  const nota = Number(draft.quality_score ?? 0)
  if (draft.needs_human) bloqueios.push("reprovado no crivo")
  if (nota < settings.nota_minima_auto) bloqueios.push(`nota ${nota} abaixo de ${settings.nota_minima_auto}`)
  if (
    settings.luto_sempre_manual &&
    /luto|despedida|póstum|postum|falecid|partiu|saudade eterna/i.test(
      `${draft.persona ?? ""} ${draft.emocao_alvo ?? ""} ${draft.topic ?? ""}`,
    )
  ) {
    bloqueios.push("tema de luto exige aprovação humana")
  }
  if (settings.pedido_real_manual && draft.source_type === "pedido") {
    bloqueios.push("peça de história real exige aprovação humana")
  }

  if (bloqueios.length) {
    await logContentEvent(supabase, draft.id, "rascunho_criado", `publicação automática barrada: ${bloqueios.join("; ")}`, "system")
    return { ok: true, draftId: draft.id, briefing, publicado: false, bloqueios }
  }

  await supabase
    .from("content_drafts")
    .update({ status: "aprovado", reviewed_at: new Date().toISOString() })
    .eq("id", draft.id)
  await publishDraft(supabase, draft.id)

  return { ok: true, draftId: draft.id, briefing, publicado: true }
}
