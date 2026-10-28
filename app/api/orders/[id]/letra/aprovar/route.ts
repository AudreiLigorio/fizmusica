import { NextRequest, NextResponse, after } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { triggerSunoGeneration } from "@/lib/suno/trigger"
import { getComposerSettings } from "@/lib/composer/settings"
import { logOrderEvent } from "@/lib/orderEvents"
import { LIMITE_LETRA, medirLetra, excessoEstaNasInstrucoes } from "@/lib/suno/limites"

export const dynamic = "force-dynamic"

// Aprova a letra: salva o texto final (possivelmente editado à mão) e trava.
// A partir daqui o pedido segue pra produção (gate do admin é da Fase 3).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { lyrics, musicName } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("paymentStatus, lyricsApproved, lyricsDraft, musicalStyle, voiceType, emotion, honoreeName, nome, subcategory, revision_note, style_confirmed, style_reference")
    .eq("id", id)
    .single()

  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  if (order.paymentStatus !== "PAID") return NextResponse.json({ error: "Pedido ainda não está pago." }, { status: 403 })
  if (order.lyricsApproved) return NextResponse.json({ error: "A letra já foi aprovada." }, { status: 409 })

  const final = (lyrics ?? order.lyricsDraft ?? "").trim()
  if (!final) return NextResponse.json({ error: "Não há letra para aprovar." }, { status: 400 })

  // Barra a letra longa AQUI, antes de aprovar.
  //
  // O Suno recusa acima de 5000 caracteres, mas só na hora de gerar — e aí o
  // cliente já aprovou, já está esperando, e a recusa vem como falha de
  // produção. Aconteceu em produção com 5400 caracteres (#5C4FB68C).
  // Impedir na aprovação troca um erro silencioso por uma frase que diz
  // quanto cortar — e, desde o #8DE81BD7, ONDE cortar (ver `medirLetra`).
  const medida = medirLetra(final)
  if (medida.total > LIMITE_LETRA) {
    const n = (v: number) => v.toLocaleString("pt-BR")
    // Duas frases diferentes, porque o conserto é diferente. Quando a letra
    // cantada caberia sozinha, o excesso está no briefing entre colchetes e
    // pedir "corte a letra" manda a pessoa destruir o que estava certo.
    return NextResponse.json(
      {
        error: excessoEstaNasInstrucoes(medida)
          ? `A sua letra cantada tem ${n(medida.cantada)} caracteres e caberia bem. `
            + `Só que as instruções entre colchetes somam outros ${n(medida.instrucoes)}, `
            + `e o estúdio de IA conta tudo junto: ${n(medida.total)} de um limite de ${n(LIMITE_LETRA)}. `
            + `Encurte as instruções — tire as que se repetem e deixe só as marcações de estrutura — e aprove de novo. Os versos podem ficar como estão.`
          : `Sua letra tem ${n(medida.total)} caracteres e o limite é ${n(LIMITE_LETRA)}. `
            + `Tire cerca de ${n(medida.total - LIMITE_LETRA)} caracteres e aprove de novo.`,
      },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from("orders")
    .update({
      lyricsDraft: final,
      lyricsApproved: true,
      lyricsApprovedAt: new Date().toISOString(),
      // Recusa pendente com o cliente se resolve aqui: ele leu o aviso, mexeu
      // na letra e aprovou de novo. Se o fornecedor recusar outra vez, a falha
      // regrava o código — não fica preso ao problema anterior.
      lyrics_rejection: null,
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
