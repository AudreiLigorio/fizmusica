import type { createServerClient } from "@/lib/supabase"

type DB = ReturnType<typeof createServerClient>

// Fidelidade "Minha Carreira" — concessão de discos e cálculo de nível.
//
// Duas regras da spec mandam no desenho deste arquivo:
//
// 1) "Benefício é calculado no BACKEND" — nível e desconto saem daqui, nunca
//    do navegador. A tela só desenha o que este módulo devolveu.
// 2) "Histórico imutável" — o saldo é sempre a SOMA de loyalty_transactions.
//    Não existe contador pra alguém editar; correção é transação nova.

export type Nivel = {
  id: number
  nome: string
  icone: string
  minDiscos: number
  descontoDigital: number
  descontoFisico: number
  artePrefixo: string | null
}

export type Carreira = {
  discos: number
  nivel: Nivel
  proximo: Nivel | null
  faltam: number       // discos para o próximo nível (0 se já é o último)
  progresso: number    // 0..1 dentro da faixa atual, para a barra
}

// Digital ganha 1 disco, físico 2. A distinção existe porque produto físico
// tem custo e margem diferentes — a spec pede tabelas separadas pelos dois.
const DISCOS_POR_COMPRA = { digital: 1, fisico: 2 } as const

export async function listarNiveis(supabase: DB): Promise<Nivel[]> {
  const { data } = await supabase
    .from("loyalty_levels")
    .select("id, nome, icone, min_discos, desconto_digital, desconto_fisico, arte_prefixo")
    .eq("ativo", true)
    .order("min_discos", { ascending: true })

  return (data ?? []).map((n) => ({
    id: n.id as number,
    nome: n.nome as string,
    icone: n.icone as string,
    minDiscos: n.min_discos as number,
    descontoDigital: n.desconto_digital as number,
    descontoFisico: n.desconto_fisico as number,
    artePrefixo: (n.arte_prefixo as string | null) ?? null,
  }))
}

// Saldo = soma das transações. Pode ser negativo em teoria (estorno maior que
// o ganho); trava em 0 na exibição pra não mostrar "-1 discos" ao cliente.
export async function saldoDiscos(supabase: DB, userId: string): Promise<number> {
  const { data } = await supabase
    .from("loyalty_transactions")
    .select("discos")
    .eq("user_id", userId)

  return (data ?? []).reduce((s, t) => s + (t.discos as number), 0)
}

export async function carreiraDoUsuario(supabase: DB, userId: string): Promise<Carreira | null> {
  const niveis = await listarNiveis(supabase)
  if (niveis.length === 0) return null

  const discos = Math.max(0, await saldoDiscos(supabase, userId))

  // Último nível cujo piso o cliente alcançou.
  let atual = niveis[0]
  for (const n of niveis) if (discos >= n.minDiscos) atual = n
  const proximo = niveis.find((n) => n.minDiscos > atual.minDiscos) ?? null

  const faltam = proximo ? Math.max(0, proximo.minDiscos - discos) : 0
  const faixa = proximo ? proximo.minDiscos - atual.minDiscos : 0
  const progresso = faixa > 0 ? Math.min(1, (discos - atual.minDiscos) / faixa) : 1

  return { discos, nivel: atual, proximo, faltam, progresso }
}

// Desconto que o nível do cliente dá neste preço. Calculado no servidor, como
// a spec exige — o navegador nunca decide quanto alguém ganha.
//
// Devolve 0 pra visitante sem conta: fidelidade pendura em user_id, e pedido
// de checkout sem login não tem a quem creditar.
export async function descontoDeFidelidade(
  supabase: DB,
  userId: string | null | undefined,
  precoBruto: number,
  fisico: boolean,
): Promise<{ desconto: number; percentual: number; nivel: Nivel | null }> {
  const vazio = { desconto: 0, percentual: 0, nivel: null }
  if (!userId) return vazio

  const carreira = await carreiraDoUsuario(supabase, userId)
  if (!carreira) return vazio

  const percentual = fisico ? carreira.nivel.descontoFisico : carreira.nivel.descontoDigital
  if (percentual <= 0) return { desconto: 0, percentual: 0, nivel: carreira.nivel }

  // Arredonda pra centavo, sempre a favor do cliente no empate.
  const desconto = Math.round(precoBruto * percentual) / 100
  return { desconto, percentual, nivel: carreira.nivel }
}

// Concede os discos de um pedido pago. IDEMPOTENTE de propósito: a confirmação
// de pagamento tem seis pontos de entrada neste projeto (webhook, confirm,
// create, sync e reconcile do admin, cupom de 100%), então esta função vai ser
// chamada repetido pro mesmo pedido. Quem garante o "uma vez só" é o índice
// único (order_id, tipo) da migração 053 — não a confiança em cada chamador.
//
// Devolve true só quando REALMENTE concedeu, pra o chamador poder disparar a
// celebração de subida de nível sem repetir a cada rechamada.
export async function concederDiscosDoPedido(supabase: DB, orderId: string): Promise<boolean> {
  const { data: order } = await supabase
    .from("orders")
    .select("id, userId, paymentStatus, products(category)")
    .eq("id", orderId)
    .maybeSingle()

  // Sem dono não há a quem creditar. Acontece em pedido antigo (checkout sem
  // conta) — não é erro, só não gera disco.
  if (!order?.userId) return false
  if (order.paymentStatus !== "PAID") return false

  // Categorias reais no banco: DIGITAL e DIGITAL_PHYSICAL (conferido, não
  // suposto). Vale o disco maior sempre que houver item físico no plano.
  const produto = Array.isArray(order.products) ? order.products[0] : order.products
  const fisico = (produto?.category as string | null ?? "").toUpperCase().includes("PHYSICAL")
  const tipo = fisico ? "PURCHASE_PHYSICAL" : "PURCHASE_DIGITAL"
  const discos = fisico ? DISCOS_POR_COMPRA.fisico : DISCOS_POR_COMPRA.digital

  const { error } = await supabase.from("loyalty_transactions").insert({
    user_id: order.userId,
    order_id: order.id,
    tipo,
    discos,
    descricao: fisico ? "Compra de produto físico" : "Compra de música digital",
  })

  // 23505 = violação do índice único: já tinha sido concedido. É o caminho
  // esperado numa rechamada, não uma falha.
  if (error) {
    if (error.code === "23505") return false
    console.error("[fidelidade] concessão falhou", orderId, error.message)
    return false
  }
  return true
}

// Estorno: transação reversa, nunca apagar a original. Sem trava de índice
// único de propósito — um pedido pode ser estornado e ajustado mais de uma vez.
export async function estornarDiscosDoPedido(supabase: DB, orderId: string, motivo?: string): Promise<void> {
  const { data: txs } = await supabase
    .from("loyalty_transactions")
    .select("user_id, discos")
    .eq("order_id", orderId)
    .in("tipo", ["PURCHASE_DIGITAL", "PURCHASE_PHYSICAL", "REFERRAL_CONVERTED"])

  for (const t of txs ?? []) {
    await supabase.from("loyalty_transactions").insert({
      user_id: t.user_id,
      order_id: orderId,
      tipo: "REFUND",
      discos: -(t.discos as number),
      descricao: motivo ?? "Estorno da compra",
    })
  }
}
