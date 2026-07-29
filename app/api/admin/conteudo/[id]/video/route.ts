import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { createVideoJob, syncVideoIngredients, type VideoRecipe } from "@/lib/content/video-ingredients"
import { trocarCena, trocarNarracao, trocarMusica, sincronizarMusicaNova } from "@/lib/content/video-partes"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // gerar uma cena nova espera a KIE responder

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyAdminToken(token) : false
}

// Cria um job de vídeo pro rascunho — gera as N imagens de cena + a música,
// mas não monta o vídeo (isso é o worker local, ver scripts/video-worker/).
// body: { scenes: [{description, caption}], songTheme, songStyle, platform }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { scenes, songTheme, songStyle, platform, songSource, songOrderId, narracaoTexto, narracaoVoz, narracaoFundo } = body ?? {}

  if (!Array.isArray(scenes) || scenes.length < 3 || scenes.length > 6) {
    return NextResponse.json({ error: "Informe de 3 a 6 cenas." }, { status: 400 })
  }
  // Tema e estilo só fazem sentido quando a música vai ser criada agora. Se o
  // áudio é a música real do pedido, não há o que descrever.
  if (songSource === "narracao" && !narracaoTexto?.trim()) {
    return NextResponse.json({ error: "Escreva o texto da narração." }, { status: 400 })
  }
  // Música nova é exigida tanto como trilha principal quanto como fundo da
  // narração — nos dois casos alguém precisa dizer tema e estilo.
  const precisaDescreverMusica =
    (!songSource || songSource === "suno") || (songSource === "narracao" && narracaoFundo === "suno")
  if (precisaDescreverMusica && (!songTheme?.trim() || !songStyle?.trim())) {
    return NextResponse.json({ error: "Informe o tema e o estilo da música." }, { status: 400 })
  }

  const recipe: VideoRecipe = {
    scenes,
    songTheme: songTheme ?? "",
    songStyle: songStyle ?? "",
    platform: platform || "instagram",
    songSource: ["pedido", "narracao"].includes(songSource) ? songSource : "suno",
    songOrderId: songOrderId || undefined,
    narracaoTexto: narracaoTexto || undefined,
    narracaoVoz: narracaoVoz || undefined,
    narracaoFundo: ["nenhum", "pedido", "suno"].includes(narracaoFundo) ? narracaoFundo : "nenhum",
  }

  const supabase = createServerClient()
  try {
    const job = await createVideoJob(supabase, id, recipe)
    return NextResponse.json({ ok: true, job })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao criar job de vídeo." }, { status: 500 })
  }
}

// Estado do job (polling, pra tela de qualificação acompanhar a geração dos
// ingredientes até ficar "pronto_pra_renderizar" — daí em diante é o worker).
// Troca UMA parte do vídeo, preservando o resto. É a diferença entre corrigir
// e recomeçar: a cena 2 saiu errada, mas a narração e a música estavam boas.
// body: { parte: "cena", indice, description?, caption? }
//     | { parte: "narracao", texto?, voz? }
//     | { parte: "musica", origem: "pedido", orderId } | { parte: "musica", origem: "suno" }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  try {
    if (body.parte === "cena") {
      const r = await trocarCena(supabase, id, Number(body.indice), body.description, body.caption)
      return NextResponse.json({ ok: true, ...r })
    }
    if (body.parte === "narracao") {
      const r = await trocarNarracao(supabase, id, body.texto, body.voz)
      return NextResponse.json({ ok: true, ...r })
    }
    if (body.parte === "musica") {
      const r = await trocarMusica(supabase, id, body.origem, body.orderId)
      return NextResponse.json({ ok: true, ...r })
    }
    return NextResponse.json({ error: "Parte inválida." }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao trocar a parte." }, { status: 500 })
  }
}

// Remonta o vídeo a partir dos ingredientes que já existem — custo ZERO de
// IA, só o tempo do worker. É o que faltava: até aqui, mudar uma legenda de
// cena obrigava a regerar imagens e música do zero.
// body: { scenes?, songTheme?, songStyle? } — ajustes de texto entram na receita.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const supabase = createServerClient()

  const { data: job } = await supabase
    .from("video_jobs")
    .select("id, status, recipe, scene_image_urls, song_url, narration_url")
    .eq("contentDraftId", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!job) return NextResponse.json({ error: "Não há vídeo para remontar." }, { status: 404 })

  // Ingrediente apagado (peça já publicada, ou job antigo) não volta: remontar
  // sem as imagens produziria um vídeo quebrado, e é melhor dizer isso.
  if (!job.scene_image_urls?.length || (!job.song_url && !job.narration_url)) {
    return NextResponse.json(
      { error: "Os ingredientes deste vídeo já foram descartados (a peça foi publicada). Crie um vídeo novo." },
      { status: 400 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const receita = { ...(job.recipe as Record<string, unknown>) }
  if (Array.isArray(body.scenes) && body.scenes.length) receita.scenes = body.scenes
  if (typeof body.songTheme === "string") receita.songTheme = body.songTheme
  if (typeof body.songStyle === "string") receita.songStyle = body.songStyle

  const { error } = await supabase
    .from("video_jobs")
    .update({ recipe: receita, status: "pronto_pra_renderizar", error: null, claimed_at: null })
    .eq("id", job.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, job: { ...job, status: "pronto_pra_renderizar" } })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await params
  const supabase = createServerClient()
  const { data: job } = await supabase
    .from("video_jobs")
    .select("*")
    .eq("contentDraftId", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!job) return NextResponse.json({})

  // Música nova pedida numa troca de parte: o Suno leva minutos, então o
  // polling da tela é quem descobre que ficou pronta.
  if (job.status !== "gerando_ingredientes" && job.song_task_id && !job.song_url) {
    const atualizado = await sincronizarMusicaNova(supabase, job.id)
    return NextResponse.json({ job: atualizado })
  }

  if (job.status !== "gerando_ingredientes") return NextResponse.json({ job })

  try {
    const updated = await syncVideoIngredients(supabase, job.id)
    return NextResponse.json({ job: updated })
  } catch (e) {
    return NextResponse.json({ job, error: e instanceof Error ? e.message : "Erro ao sincronizar." })
  }
}
