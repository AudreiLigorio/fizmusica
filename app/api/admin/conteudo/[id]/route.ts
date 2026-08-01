import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { syncImageTask, runGeneration, createDraft } from "@/lib/content/generate"
import { publishDraft } from "@/lib/content/publish"
import { logContentEvent } from "@/lib/content/events"
import { purgeDraftMedia } from "@/lib/content/media"
import { registrarLicao } from "@/lib/content/licoes"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // publicação de Reels espera o processamento do vídeo (polling)

// Retrato da peça pra IA entender a crítica. Usado na aprovação com ressalva e
// na rejeição — nos dois casos o que ensina é a crítica ANCORADA na peça.
async function contextoDaPeca(supabase: ReturnType<typeof createServerClient>, id: string) {
  const { data: peca } = await supabase
    .from("content_drafts")
    .select("platform, topic, hook_text, caption, persona, emocao_alvo, roteiro")
    .eq("id", id)
    .maybeSingle()
  if (!peca) return null

  const cenas = (peca.roteiro as { cenas?: { caption: string; description: string }[] } | null)?.cenas ?? []
  return (
    `Rede: ${peca.platform} · tema: ${peca.topic ?? "de pedido real"}\n` +
    `Persona: ${peca.persona ?? "?"} · emoção: ${peca.emocao_alvo ?? "?"}\n` +
    `Gancho: ${peca.hook_text ?? "—"}\n` +
    `Legenda: ${peca.caption ?? "—"}` +
    (cenas.length ? `\nCenas:\n${cenas.map((c, i) => `  ${i + 1}. [${c.caption}] ${c.description}`).join("\n")}` : "")
  )
}

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
// body: { action: "sincronizar" | "editar" | "regerar" | "aprovar" | "rejeitar" | "publicar" | "apagar_midia" | "excluir" | "adaptar", rejectionReason?, caption?, hashtags?, platform? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const { action, rejectionReason, caption, hashtags, platform, feedback } = await req.json().catch(() => ({}))
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

  // Mesma história, outra rede. Cria uma peça NOVA (a rede de destino tem
  // formato, ritmo e CTA próprios) ligada à original por derivado_de — é essa
  // ligação que mostra depois "esta história já foi publicada onde".
  if (action === "adaptar") {
    if (!["instagram", "tiktok", "youtube"].includes(platform)) {
      return NextResponse.json({ error: "Rede de destino inválida." }, { status: 400 })
    }
    const { data: origem } = await supabase
      .from("content_drafts")
      .select("id, platform, source_type, sourceOrderId, topic, derivado_de")
      .eq("id", id)
      .maybeSingle()
    if (!origem) return NextResponse.json({ error: "Peça de origem não encontrada." }, { status: 404 })
    if (origem.platform === platform) {
      return NextResponse.json({ error: "A peça já é dessa rede." }, { status: 400 })
    }

    // A raiz da família é sempre a peça original, não a adaptação — assim uma
    // adaptação de adaptação não cria corrente.
    const raiz = origem.derivado_de ?? origem.id

    try {
      const nova = origem.source_type === "pedido"
        ? await createDraft(supabase, { platform, sourceType: "pedido", sourceOrderId: origem.sourceOrderId, derivadoDe: raiz })
        : await createDraft(supabase, { platform, sourceType: "generico", topic: origem.topic ?? "", derivadoDe: raiz })

      // Reaproveita o vídeo da peça de origem: as imagens de cena, a narração e
      // a trilha são o caro da produção, e a história é a mesma. O que muda por
      // rede é a marca queimada no rodapé (@handle/CTA) e, no YouTube, o
      // formato — e isso se resolve remontando, que é grátis.
      let videoReaproveitado = false
      const { data: jobOrigem } = await supabase
        .from("video_jobs")
        .select("recipe, scene_image_urls, narration_url, song_url")
        .eq("contentDraftId", origem.id)
        .not("scene_image_urls", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const temIngredientes =
        (jobOrigem?.scene_image_urls?.length ?? 0) > 0 && (jobOrigem?.song_url || jobOrigem?.narration_url)

      if (temIngredientes) {
        const receita = { ...(jobOrigem!.recipe as Record<string, unknown>), platform }
        await supabase.from("video_jobs").insert({
          contentDraftId: nova.id,
          status: "storyboard", // entra no editor: você confere e manda compilar
          recipe: receita,
          scene_image_urls: jobOrigem!.scene_image_urls,
          scene_image_task_ids: [],
          narration_url: jobOrigem!.narration_url,
          song_url: jobOrigem!.song_url,
        })
        videoReaproveitado = true
      }

      return NextResponse.json({ ok: true, draft: nova, videoReaproveitado })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao adaptar." }, { status: 500 })
    }
  }

  if (action === "aprovar") {
    const { error } = await supabase
      .from("content_drafts")
      .update({ status: "aprovado", reviewed_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Aprovação com ressalva: a peça serve, mas algo dava pra melhorar. É o
    // sinal mais comum e o que mais se perdia — ninguém rejeita uma peça boa
    // só porque um detalhe incomodou, então esse aprendizado sumia.
    let licao: string | null = null
    if (typeof feedback === "string" && feedback.trim()) {
      const contexto = await contextoDaPeca(supabase, id)
      if (contexto) licao = await registrarLicao(supabase, { feedback, contexto })
    }

    await logContentEvent(supabase, id, "aprovado", feedback ? `ressalva: ${feedback}` : undefined, "admin")
    return NextResponse.json({ ok: true, status: "aprovado", licao })
  }

  // Exclusão definitiva a pedido do admin — mesmo efeito da rejeição, mas
  // disponível em qualquer estado, inclusive peça já publicada (o post na rede
  // continua no ar; o que sai é o registro daqui).
  if (action === "excluir") {
    const purge = await purgeDraftMedia(supabase, id)
    await supabase.from("content_links").delete().eq("draft_id", id)
    const { error } = await supabase.from("content_drafts").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, removido: true, midiaApagada: purge.arquivos })
  }

  // Rejeitar apaga tudo: peça recusada não vira histórico, vira lixo no painel.
  // Ordem importa — primeiro os arquivos (o registro é quem sabe onde eles
  // estão), depois o link rastreado (nunca foi publicado, então nada aponta
  // pra ele), e só então a linha. As tabelas filhas (content_events,
  // video_jobs) somem por cascade.
  if (action === "rejeitar") {
    // O motivo da rejeição é o único momento em que a insatisfação vira texto.
    // Precisa ser lido ANTES do delete: depois, a peça e a crítica somem juntas.
    let licao: string | null = null
    if (typeof rejectionReason === "string" && rejectionReason.trim()) {
      const contexto = await contextoDaPeca(supabase, id)
      if (contexto) licao = await registrarLicao(supabase, { feedback: rejectionReason, contexto })
    }

    const purge = await purgeDraftMedia(supabase, id)

    await supabase.from("content_links").delete().eq("draft_id", id)

    const { error } = await supabase.from("content_drafts").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, removido: true, midiaApagada: purge.arquivos, licao })
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
