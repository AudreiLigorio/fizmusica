import type { createServerClient } from "@/lib/supabase"

type DB = ReturnType<typeof createServerClient>

// Saldo de créditos do pacote pré-pago ("10 músicas por R$ 49,90").
//
// O saldo NÃO é uma coluna: é a soma dos deltas em `credit_transactions`
// (migração 071). Mesma escolha de `order_events` e `loyalty_transactions` —
// razão append-only, correção é transação nova, nunca UPDATE. Aqui isso pesa
// mais que nos outros dois, porque "dar errado" significa alguém ter pago e
// não ter recebido, e sem histórico não há como provar o que aconteceu.
//
// E o crédito vive no `user_id`, o que o torna intransferível de graça: não é
// regra que alguém precisa lembrar de validar, é o modelo de dados. Foi o
// motivo de descartarmos o atalho do cupom de 100% com 10 usos.

export type OrigemCredito = "pacote" | "consumo" | "estorno" | "ajuste_admin"

export type LancamentoCredito = {
  delta: number
  origem: OrigemCredito
  descricao: string | null
  orderId: string | null
  em: string
}

/** Soma dos deltas do usuário. Zero quando não há lançamento nenhum. */
export async function saldoDeCreditos(supabase: DB, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("delta")
    .eq("user_id", userId)

  if (error) {
    // Saldo é dinheiro: na dúvida devolve zero e deixa o chamador decidir, em
    // vez de arriscar oferecer um crédito que talvez não exista.
    console.error("[credits] falha ao somar saldo", error.message)
    return 0
  }
  return (data ?? []).reduce((total, l) => total + Number(l.delta ?? 0), 0)
}

/**
 * Credita — compra de pacote, estorno ou ajuste do admin.
 *
 * `orderId` é o pedido da COMPRA do pacote, não o da música. Serve para o
 * extrato dizer de onde veio o crédito e para o estorno saber o que devolver.
 */
export async function creditar(
  supabase: DB,
  args: { userId: string; quantidade: number; origem: Exclude<OrigemCredito, "consumo">; orderId?: string | null; descricao?: string },
): Promise<boolean> {
  if (!Number.isInteger(args.quantidade) || args.quantidade === 0) {
    console.error("[credits] quantidade inválida ao creditar:", args.quantidade)
    return false
  }
  const { error } = await supabase.from("credit_transactions").insert({
    user_id: args.userId,
    order_id: args.orderId ?? null,
    delta: args.quantidade,
    origem: args.origem,
    descricao: args.descricao ?? null,
  })
  if (error) {
    console.error("[credits] falha ao creditar", error.message)
    return false
  }
  return true
}

/**
 * Gasta um crédito. Devolve `false` quando não havia saldo — e aí NADA foi
 * lançado, então o chamador pode cair no pagamento normal.
 *
 * Passa pela função `gastar_credito` do banco de propósito. Ler o saldo aqui
 * e inserir o -1 em seguida deixaria uma janela entre os dois passos: duas
 * abas abertas gastariam o mesmo crédito duas vezes. No banco, a leitura
 * trava as linhas do usuário e o insert só acontece se o saldo já for
 * suficiente — tudo numa instrução.
 */
export async function gastarCredito(
  supabase: DB,
  args: { userId: string; orderId: string; quantidade?: number; descricao?: string },
): Promise<boolean> {
  const { data, error } = await supabase.rpc("gastar_credito", {
    p_user_id: args.userId,
    p_order_id: args.orderId,
    p_quantidade: args.quantidade ?? 1,
    p_descricao: args.descricao ?? null,
  })
  if (error) {
    console.error("[credits] falha ao gastar crédito", error.message)
    return false
  }
  return data === true
}

/** Extrato do cliente, do mais recente para o mais antigo. */
export async function extratoDeCreditos(
  supabase: DB,
  userId: string,
  limite = 50,
): Promise<LancamentoCredito[]> {
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("delta, origem, descricao, order_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limite)

  if (error) {
    console.error("[credits] falha ao ler extrato", error.message)
    return []
  }
  return (data ?? []).map((l) => ({
    delta: Number(l.delta),
    origem: l.origem as OrigemCredito,
    descricao: l.descricao ?? null,
    orderId: l.order_id ?? null,
    em: l.created_at as string,
  }))
}

/**
 * Este produto pode ser comprado com crédito?
 *
 * É aqui que a exigência do Audrei vira código: o crédito não vale em
 * qualquer coisa. Só produto com `credit_price` preenchido aceita — a música
 * avulsa recebe 1, Retrospectiva e Premium ficam nulos.
 */
export function precoEmCreditos(produto: { credit_price?: number | null } | null | undefined): number | null {
  const p = produto?.credit_price
  return typeof p === "number" && p > 0 ? p : null
}

/** Quantos créditos a compra deste produto concede (0 quando não é pacote). */
export function creditosConcedidos(produto: { credits_granted?: number | null } | null | undefined): number {
  const n = produto?.credits_granted
  return typeof n === "number" && n > 0 ? n : 0
}
