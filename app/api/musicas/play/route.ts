import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// Registra UMA reprodução de música.
//
// Chamada pelo player quando o áudio começa de verdade a tocar — não no
// clique. A diferença importa: o player pré-carrega a próxima faixa da fila
// num <audio> mudo, e contar no clique (ou dentro de /api/audio, por onde o
// pré-carregamento também passa) inflaria o ranking com músicas que ninguém
// chegou a ouvir.
//
// A repetição da mesma sessão é descartada no banco (índice único por
// música+sessão+hora), então recarregar a página, arrastar a barra ou deixar
// no repetir não sobe o número.
export async function POST(req: NextRequest) {
  const { orderId, sessao } = await req.json().catch(() => ({}))
  if (typeof orderId !== "string" || !orderId) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const supabase = createServerClient()

  // Só conta música que está mesmo na Rede. Sem isto, qualquer um poderia
  // mandar POST com o id de um pedido privado e criar contagem pra algo que
  // não é público — sujaria o ranking e ainda diria, pela resposta, que
  // aquele pedido existe.
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("status", "DELIVERED")
    .eq("publication_consent", true)
    .maybeSingle()

  if (!order) return NextResponse.json({ ok: false }, { status: 404 })

  const { error } = await supabase.rpc("registrar_play", {
    p_order_id: orderId,
    p_sessao: typeof sessao === "string" && sessao ? sessao.slice(0, 64) : null,
  })

  // Falha aqui NUNCA pode atrapalhar quem está ouvindo: contagem é secundária
  // à música. Enquanto a migração 057 não roda, a função não existe e isto
  // responde ok:false sem quebrar o player.
  if (error) return NextResponse.json({ ok: false, motivo: "indisponivel" })

  return NextResponse.json({ ok: true })
}
