import type { createServerClient } from "@/lib/supabase"
import { createDraft, syncImageTask } from "@/lib/content/generate"
import { getContentSettings, decidirPauta, type Briefing } from "@/lib/content/cmo"
import { publishDraft } from "@/lib/content/publish"
import { logContentEvent } from "@/lib/content/events"

type DB = ReturnType<typeof createServerClient>

// A geração de imagem na KIE.ai é assíncrona (30-90s) — createDraft só dispara
// a tarefa e devolve. Sem esperar aqui, o modo automático aprovava e tentava
// publicar uma peça sem imagem nenhuma: o publishDraft explodia com "Rascunho
// sem imagem nem vídeo", e como o status já tinha virado "aprovado" antes da
// chamada, a peça ficava presa assim pra sempre (spinner eterno no painel).
async function esperarImagem(supabase: DB, draftId: string, timeoutMs = 150_000, intervalMs = 5_000) {
  const inicio = Date.now()
  while (Date.now() - inicio < timeoutMs) {
    const draft = await syncImageTask(supabase, draftId)
    if (draft.image_url || draft.image_error) return draft
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return null
}

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

  // Só vale esperar a imagem se nenhuma trava de conteúdo já tiver barrado —
  // sem gastar até 2,5min de espera numa peça que nem ia publicar mesmo.
  if (!bloqueios.length) {
    const imagem = await esperarImagem(supabase, draft.id)
    if (!imagem?.image_url) {
      bloqueios.push(
        imagem?.image_error
          ? `imagem falhou: ${imagem.image_error}`
          : "imagem não terminou de gerar a tempo — continua como rascunho pra revisão manual",
      )
    }
  }

  if (bloqueios.length) {
    await logContentEvent(supabase, draft.id, "rascunho_criado", `publicação automática barrada: ${bloqueios.join("; ")}`, "system")
    return { ok: true, draftId: draft.id, briefing, publicado: false, bloqueios }
  }

  await supabase
    .from("content_drafts")
    .update({ status: "aprovado", reviewed_at: new Date().toISOString() })
    .eq("id", draft.id)

  try {
    await publishDraft(supabase, draft.id)
  } catch (e) {
    // O status já virou "aprovado" de propósito: a imagem existe, só a
    // publicação falhou (rede fora do ar, etc). O card mostra o botão
    // "📤 Publicar no Instagram" pra tentar de novo manualmente — não fica
    // "aprovado" fantasma como no bug original, porque a mídia está lá.
    const msg = e instanceof Error ? e.message : "falha ao publicar"
    return { ok: true, draftId: draft.id, briefing, publicado: false, bloqueios: [msg] }
  }

  return { ok: true, draftId: draft.id, briefing, publicado: true }
}
