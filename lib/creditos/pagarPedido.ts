import type { createServerClient } from "@/lib/supabase"
import { ensurePaymentPrep } from "@/lib/payments/prep"
import { gastarCredito, creditar, precoEmCreditos } from "@/lib/credits"

type DB = ReturnType<typeof createServerClient>

export type ResultadoPagamento =
  | { ok: true; creditosUsados: number; jaPago?: boolean }
  | { ok: false; erro: string }

/**
 * Paga um pedido com CRÉDITO do saldo, em vez de dinheiro.
 *
 * Isto era o corpo de `POST /api/creditos/usar`. Saiu de lá porque ganhou um
 * SEGUNDO chamador: a compra de pacote feita de dentro do funil, que precisa
 * gastar 1 crédito no pedido de música assim que o pacote é creditado — e esse
 * caminho roda no servidor, sem requisição do cliente para hospedar a lógica.
 * Duplicar daria duas versões do estorno e da preparação, que é exatamente o
 * erro que já custou o e-mail de música pronta e o cupom de fidelidade.
 *
 * NÃO verifica dono: quem chama já sabe de quem é o pedido (a rota confere o
 * token; o pacote nasce preso ao usuário). Manter a checagem aqui obrigaria o
 * caminho do servidor a inventar um "usuário da requisição" que não existe.
 */
export async function pagarPedidoComCredito(
  supabase: DB,
  { userId, orderId, productId }: { userId: string; orderId: string; productId: string },
): Promise<ResultadoPagamento> {
  const { data: order } = await supabase
    .from("orders")
    .select("id, paymentStatus")
    .eq("id", orderId)
    .maybeSingle()

  if (!order) return { ok: false, erro: "Pedido não encontrado." }
  if (order.paymentStatus === "PAID") return { ok: true, creditosUsados: 0, jaPago: true }

  // Preço em crédito SEMPRE do banco. É aqui que "o crédito não vale em
  // qualquer coisa" para de ser promessa: produto sem `credit_price` recusa.
  const { data: produto } = await supabase
    .from("products").select("id, name, credit_price").eq("id", productId).maybeSingle()
  const custo = precoEmCreditos(produto)
  if (!produto || custo === null) {
    return { ok: false, erro: "Este plano não pode ser pago com créditos." }
  }

  // Recuperação de meio-caminho: se já existe o débito deste pedido, o crédito
  // saiu numa tentativa anterior que não chegou a marcar o pagamento. Seguir
  // sem debitar de novo é o certo — debitar duas vezes seria cobrar duas.
  const { data: jaDebitado } = await supabase
    .from("credit_transactions")
    .select("id").eq("order_id", orderId).eq("origem", "consumo").maybeSingle()

  if (!jaDebitado) {
    const ok = await gastarCredito(supabase, {
      userId, orderId, quantidade: custo,
      descricao: produto.name ?? "Música",
    })
    if (!ok) {
      return {
        ok: false,
        erro: custo === 1 ? "Você não tem crédito disponível." : `Você precisa de ${custo} créditos.`,
      }
    }
  }

  const agora = new Date().toISOString()
  const { error: errPedido } = await supabase
    .from("orders")
    .update({ productId, paymentStatus: "PAID", updatedAt: agora })
    .eq("id", orderId)

  if (errPedido) {
    // O crédito já saiu e o pedido não virou pago. Devolve na hora, pela
    // própria razão — é exatamente para isto que ela existe. Sem o estorno a
    // pessoa perderia o crédito sem receber nada.
    console.error("[creditos] pedido não virou pago, estornando", orderId, errPedido.message)
    await creditar(supabase, {
      userId, quantidade: custo, origem: "estorno", orderId,
      descricao: "Devolução: a música não pôde ser liberada",
    })
    return { ok: false, erro: "Não foi possível concluir. Seu crédito foi devolvido." }
  }

  // Registro de pagamento de R$ 0, como o caminho do cupom faz — sem ele o
  // pedido aparece pago sem nenhum pagamento no relatório.
  await supabase.from("payments").upsert({
    orderId, mpPaymentId: `CREDITO-${orderId}`, mpStatus: "approved", status: "PAID",
    amount: 0, productId, paidAt: agora, updatedAt: agora,
  }, { onConflict: "orderId" })

  // Mesma preparação dos caminhos pagos: photo_token e e-mail "aprove a letra".
  await ensurePaymentPrep(supabase, orderId)

  return { ok: true, creditosUsados: custo }
}

/**
 * Compra de pacote feita de dentro do funil: gasta 1 crédito, na hora, no
 * pedido de música que motivou a compra.
 *
 * Chamado de `ensurePaymentPrep`, logo depois de creditar o pacote — ou seja,
 * no servidor, em TODOS os caminhos de confirmação (webhook, /confirm, /free e
 * as reconciliações do admin). Pendurar no retorno do checkout perderia
 * justamente quem paga PIX e fecha a aba.
 *
 * Silencioso por desenho: se não há vínculo, não há nada a fazer. E se o
 * débito falhar, o pacote JÁ foi creditado e a pessoa tem os 10 na conta — ela
 * paga a música com um deles pela tela normal. O log fica alto porque é
 * dinheiro e precisa aparecer no Sentry.
 */
export async function honrarPedidoVinculadoAoPacote(supabase: DB, pacoteOrderId: string): Promise<void> {
  const { data: pacote } = await supabase
    .from("orders")
    .select("id, userId, pacote_para_pedido")
    .eq("id", pacoteOrderId)
    .maybeSingle()

  const alvo = (pacote as { pacote_para_pedido?: string | null } | null)?.pacote_para_pedido
  if (!alvo || !pacote?.userId) return

  // Qual plano o crédito paga. Preferimos o que o pedido já tem escolhido,
  // quando ele aceita crédito; senão, o mais barato que aceita. Nunca um nome
  // cravado no código: o dia em que o catálogo mudar, isto continua certo.
  const { data: alvoPedido } = await supabase
    .from("orders").select("productId").eq("id", alvo).maybeSingle()

  const { data: aceitam } = await supabase
    .from("products")
    .select("id, credit_price")
    .eq("active", true)
    .not("credit_price", "is", null)
    .order("credit_price", { ascending: true })

  const lista = (aceitam ?? []) as { id: string; credit_price: number | null }[]
  if (lista.length === 0) {
    console.error("[creditos] pacote com vínculo, mas nenhum produto aceita crédito:", pacoteOrderId)
    return
  }
  const escolhido =
    lista.find((p) => p.id === alvoPedido?.productId)?.id ?? lista[0].id

  const r = await pagarPedidoComCredito(supabase, {
    userId: pacote.userId as string,
    orderId: alvo,
    productId: escolhido,
  })

  if (!r.ok) {
    console.error("[creditos] pacote creditado, mas a música vinculada não foi paga:", alvo, r.erro)
    return
  }
  console.log(`[creditos] pacote ${pacoteOrderId} pagou a música ${alvo} com ${r.creditosUsados} crédito(s)`)
}
