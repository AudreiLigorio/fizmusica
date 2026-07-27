import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { gerarRoteiro, type RoteiroSource } from "@/lib/content/roteirista"

export const dynamic = "force-dynamic"
// Duas passadas de Gemini (criação + revisão) e, quando reprova, mais duas.
// 30s do padrão não dá conta no pior caso.
export const maxDuration = 120

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyAdminToken(token) : false
}

// Gera o roteiro do VÍDEO multi-cena e devolve sem salvar — quem salva é o
// fluxo de vídeo, depois que o admin revisa/ajusta a receita na tela.
// (O post estático não passa por aqui: o roteirista já roda dentro do
// createDraft, em lib/content/generate.ts.)
// body: { platform, sourceType: "generico", topic } | { platform, sourceType: "pedido", sourceOrderId }
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { platform, sourceType, topic, sourceOrderId } = body ?? {}

  if (!platform || !["instagram", "tiktok", "youtube"].includes(platform)) {
    return NextResponse.json({ error: "Plataforma inválida." }, { status: 400 })
  }
  if (sourceType === "generico" && !topic?.trim()) {
    return NextResponse.json({ error: "Informe o tema." }, { status: 400 })
  }
  if (sourceType === "pedido" && !sourceOrderId) {
    return NextResponse.json({ error: "Informe o pedido de origem." }, { status: 400 })
  }

  const supabase = createServerClient()
  let source: RoteiroSource

  try {
    if (sourceType === "pedido") {
      const { data: order } = await supabase
        .from("orders")
        .select("id, subcategory, publication_consent, lyricsDraft")
        .eq("id", sourceOrderId)
        .maybeSingle()
      if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
      if (!order.publication_consent) {
        return NextResponse.json({ error: "Este pedido não tem consentimento de publicação." }, { status: 400 })
      }

      const { data: music } = await supabase
        .from("generated_music")
        .select("musicName, personName")
        .eq("orderId", sourceOrderId)
        .maybeSingle()

      source = {
        type: "pedido",
        subcategory: order.subcategory ?? "",
        musicName: music?.musicName?.trim() || music?.personName?.trim() || "música personalizada",
        lyricsExcerpt: order.lyricsDraft ?? "",
      }
    } else {
      source = { type: "generico", topic }
    }

    const result = await gerarRoteiro({ formato: "video", platform, source })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao gerar roteiro." }, { status: 500 })
  }
}
