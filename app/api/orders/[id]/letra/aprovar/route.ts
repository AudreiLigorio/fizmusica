import { NextRequest, NextResponse, after } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { triggerSunoGeneration } from "@/lib/suno/trigger"
import { getComposerSettings } from "@/lib/composer/settings"

export const dynamic = "force-dynamic"

// Aprova a letra: salva o texto final (possivelmente editado à mão) e trava.
// A partir daqui o pedido segue pra produção (gate do admin é da Fase 3).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { lyrics } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("paymentStatus, lyricsApproved, lyricsDraft, musicalStyle, voiceType, emotion, honoreeName, nome, subcategory, revision_note")
    .eq("id", id)
    .single()

  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  if (order.paymentStatus !== "PAID") return NextResponse.json({ error: "Pedido ainda não está pago." }, { status: 403 })
  if (order.lyricsApproved) return NextResponse.json({ error: "A letra já foi aprovada." }, { status: 409 })

  const final = (lyrics ?? order.lyricsDraft ?? "").trim()
  if (!final) return NextResponse.json({ error: "Não há letra para aprovar." }, { status: 400 })

  const { error } = await supabase
    .from("orders")
    .update({
      lyricsDraft: final,
      lyricsApproved: true,
      lyricsApprovedAt: new Date().toISOString(),
      // O rótulo do admin passa a refletir a realidade: aprovou a letra → em produção.
      status: "IN_PRODUCTION",
    })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Modo de produção (Operação): "manual" NÃO dispara o Suno — o pedido entra na
  // fila de Produção esperando o admin gerar/subir. "auto" e "review" disparam.
  const { sunoMode } = await getComposerSettings()
  if (sunoMode !== "manual") {
    // Geração em background — não bloqueia nem falha a aprovação se o Suno der erro
    // (o admin pode regerar manualmente depois).
    after(async () => {
      try {
        await triggerSunoGeneration(supabase, { id, ...order, lyricsDraft: final })
      } catch (e) {
        console.error("[letra/aprovar] disparo Suno falhou", e instanceof Error ? e.message : e)
      }
    })
  }

  return NextResponse.json({ ok: true })
}
