import { NextRequest, NextResponse, after } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { triggerSunoGeneration } from "@/lib/suno/trigger"
import { getComposerSettings } from "@/lib/composer/settings"
import { logOrderEvent } from "@/lib/orderEvents"

export const dynamic = "force-dynamic"

// Aprova a letra: salva o texto final (possivelmente editado à mão) e trava.
// A partir daqui o pedido segue pra produção (gate do admin é da Fase 3).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { lyrics, musicName } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("paymentStatus, lyricsApproved, lyricsDraft, musicalStyle, voiceType, emotion, honoreeName, nome, subcategory, revision_note, style_confirmed")
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

  await logOrderEvent(supabase, id, "letra_aprovada")

  // Título escolhido na aprovação. Se o cliente não mexeu, chega aqui a
  // sugestão da IA que ele viu na tela — em ambos os casos é um título que
  // ele teve a chance de trocar.
  //
  // Grava antes da música existir: o ingest só preenche musicName quando está
  // vazio, então isso vira o título definitivo (e é o que sai no e-mail de
  // "música pronta", que dispara depois daqui). Criar a linha de
  // generated_music cedo é seguro — quem lista música entregue filtra por
  // mp3Url/slug, que seguem nulos.
  const tituloFinal = String(musicName ?? "").trim().slice(0, 60)
  if (tituloFinal) {
    // musicNameConfirmed libera o título pra aparecer publicamente no catálogo:
    // ou é a sugestão sem nomes próprios que o cliente viu, ou é o texto que ele
    // mesmo escreveu — coberto pelo termo de publicação. Título legado (que pode
    // ter nome tirado da letra) fica com a flag falsa e segue escondido.
    const { error: gmErr } = await supabase.from("generated_music").upsert(
      { orderId: id, musicName: tituloFinal, musicNameConfirmed: true, updatedAt: new Date().toISOString() },
      { onConflict: "orderId" },
    )
    if (gmErr) console.error("[letra/aprovar] título não salvo", gmErr.message)
    else await logOrderEvent(supabase, id, "titulo_definido", tituloFinal)
  }

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
