import { createHash } from "crypto"
import { createServerClient } from "@/lib/supabase"
import { buildOrderContext } from "./context"
import { logOrderEvent } from "@/lib/orderEvents"

// Mantém o rascunho do pedido em dia com a letra que a pessoa viu na prévia.
//
// Sem isto ela compra por causa de um refrão e recebe outra música: a geração
// roda com temperature 0.9, então repetir a mesma chamada produz letra
// diferente. Aproveitar o rascunho é o que transforma a prévia em promessa
// cumprida — e de quebra a geração pós-pagamento não precisa rodar, então quem
// converte custa a mesma chamada de Gemini de antes.
//
// A trava é comparar assinaturas. `previa.assinatura` é o hash do contexto
// montado a partir da SESSÃO; aqui eu remonto o contexto a partir do PEDIDO já
// gravado e comparo. Bater significa que a história que gerou aquele refrão é
// exatamente a que foi contratada.
//
// Precisa rodar também na EDIÇÃO (o "Voltar" da tela de produtos faz PATCH e
// troca as respostas): sem isso o pedido criado com a letra da primeira prévia
// ficaria com essa letra e a história corrigida — exatamente o desencontro que
// o reaproveitamento existe pra evitar.
//
// As três revisões pós-pagamento não são tocadas: `lyricsReprocessCount` fica
// em 0 e quem usou a prévia chega na área do cliente com a letra pronta E o
// direito de revisão inteiro.
export async function sincronizarPreviaNoPedido(orderId: string, sessionId: string): Promise<void> {
  try {
    const supabase = createServerClient()

    const { data: pedido } = await supabase
      .from("orders")
      .select("paymentStatus, lyricsDraft")
      .eq("id", orderId)
      .maybeSingle()

    if (!pedido) return
    // Depois de pago a letra é assunto da área do cliente (geração, revisões,
    // edição à mão). Nada aqui pode encostar nela.
    if (pedido.paymentStatus === "PAID") return

    const contexto = await buildOrderContext(orderId)
    if (!contexto) return
    const assinatura = createHash("sha256").update(contexto).digest("hex")

    const { data: sessao } = await supabase
      .from("wizard_sessions")
      .select("data")
      .eq("id", sessionId)
      .maybeSingle()

    const previa = (sessao?.data as Record<string, any> | null)?.previa

    if (previa?.letra && previa?.assinatura === assinatura) {
      if (pedido.lyricsDraft?.trim() === previa.letra.trim()) return
      await supabase.from("orders").update({ lyricsDraft: previa.letra }).eq("id", orderId)
      await logOrderEvent(supabase, orderId, "letra_previa_aproveitada",
        "Letra da prévia do wizard reaproveitada como rascunho inicial.", "system")
      return
    }

    // A prévia não corresponde mais ao pedido. Se existe rascunho, ele só pode
    // ser descartado quando a procedência for comprovadamente a prévia — daí a
    // consulta ao histórico, em vez de assumir que todo rascunho não-pago veio
    // daqui. Rascunho de outra origem fica intacto.
    if (!pedido.lyricsDraft?.trim()) return

    const { data: evento } = await supabase
      .from("order_events")
      .select("id")
      .eq("orderId", orderId)
      .eq("type", "letra_previa_aproveitada")
      .limit(1)
      .maybeSingle()

    if (!evento) return

    await supabase.from("orders").update({ lyricsDraft: null }).eq("id", orderId)
    await logOrderEvent(supabase, orderId, "letra_previa_descartada",
      "História editada depois da prévia — rascunho descartado para ser gerado do zero.", "system")
  } catch (e) {
    // Nunca derruba a criação/edição do pedido: no pior caso a letra é gerada
    // depois do pagamento, como sempre foi.
    console.error("[sincronizarPrevia]", e instanceof Error ? e.message : e)
  }
}
