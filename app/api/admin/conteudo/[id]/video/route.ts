import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { createVideoJob, syncVideoIngredients, type VideoRecipe } from "@/lib/content/video-ingredients"

export const dynamic = "force-dynamic"
export const maxDuration = 60

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
  const { scenes, songTheme, songStyle, platform } = body ?? {}

  if (!Array.isArray(scenes) || scenes.length < 3 || scenes.length > 6) {
    return NextResponse.json({ error: "Informe de 3 a 6 cenas." }, { status: 400 })
  }
  if (!songTheme?.trim() || !songStyle?.trim()) {
    return NextResponse.json({ error: "Informe o tema e o estilo da música." }, { status: 400 })
  }

  const recipe: VideoRecipe = {
    scenes,
    songTheme,
    songStyle,
    platform: platform || "instagram",
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
  if (job.status !== "gerando_ingredientes") return NextResponse.json({ job })

  try {
    const updated = await syncVideoIngredients(supabase, job.id)
    return NextResponse.json({ job: updated })
  } catch (e) {
    return NextResponse.json({ job, error: e instanceof Error ? e.message : "Erro ao sincronizar." })
  }
}
