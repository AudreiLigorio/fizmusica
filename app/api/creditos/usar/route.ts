import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { ensurePaymentPrep } from "@/lib/payments/prep"
import { gastarCredito, creditar, precoEmCreditos } from "@/lib/credits"

export const dynamic = "force-dynamic"

// Paga um pedido com CRÉDITO do saldo, em vez de dinheiro.
//
// Espelha `/api/payments/free` (o caminho do cupom de 100%): o Mercado Pago
// não cobra R$ 0, então marcar pago aqui é o jeito. A diferença é que ali a
// autorização vem do cupom e aqui vem do saldo do próprio usuário.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 })

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: u, error: authErr } = await anon.auth.getUser(token)
  if (authErr || !u.user) return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 })
  const userId = u.user.id
  const userEmail = (u.user.email ?? "").trim().toLowerCase()

  const { orderId, productId } = await req.json().catch(() => ({}))
  if (!orderId || !productId) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 })

  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id, userId, email, paymentStatus")
    .eq("id", orderId)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })

  // O pedido tem que ser DESTE usuário. Sem isto, um orderId alheio colado na
  // requisição faria alguém pagar a música de outra pessoa com o próprio
  // saldo — e a música continuaria sendo da outra pessoa.
  //
  // Mas `userId` nulo NÃO quer dizer "de outra pessoa": quer dizer "ainda não
  // vinculado". O wizard cria o pedido sem dono, e o vínculo à conta acontece
  // depois, no GET de /api/orders. A primeira versão disto confundia os dois
  // casos e recusava o pedido recém-criado do próprio cliente com "Este
  // pedido não é seu" — foi o que o Audrei encontrou ao testar.
  let ehDono = order.userId === userId

  if (!ehDono && order.userId === null && userEmail && (order.email ?? "").trim().toLowerCase() === userEmail) {
    // Reivindica agora, com a MESMA regra do vínculo automático (e-mail
    // igual). Precisa acontecer de verdade, não só passar batido: o crédito
    // vai ficar amarrado a este pedido, e pedido sem dono deixaria o
    // lançamento órfão.
    //
    // `.is("userId", null)` na condição e não só na leitura: entre ler e
    // escrever, outro caminho pode ter vinculado o pedido. Assim só grava
    // quem chegou primeiro, e quem perdeu cai no 403 em vez de roubar.
    const { data: reivindicado } = await supabase
      .from("orders").update({ userId }).eq("id", orderId).is("userId", null).select("id")
    ehDono = !!reivindicado?.length
  }

  if (!ehDono) {
    return NextResponse.json({ error: "Este pedido não está na sua conta." }, { status: 403 })
  }

  if (order.paymentStatus === "PAID") {
    return NextResponse.json({ success: true, jaPago: true })
  }

  // Preço em crédito SEMPRE do banco. É aqui que "o crédito não vale em
  // qualquer coisa" para de ser promessa: produto sem `credit_price` recusa.
  const { data: produto } = await supabase
    .from("products").select("id, name, credit_price").eq("id", productId).maybeSingle()
  const custo = precoEmCreditos(produto)
  if (!produto || custo === null) {
    return NextResponse.json({ error: "Este plano não pode ser pago com créditos." }, { status: 400 })
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
      return NextResponse.json(
        { error: custo === 1 ? "Você não tem crédito disponível." : `Você precisa de ${custo} créditos.` },
        { status: 400 },
      )
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
    return NextResponse.json({ error: "Não foi possível concluir. Seu crédito foi devolvido." }, { status: 500 })
  }

  // Registro de pagamento de R$ 0, como o caminho do cupom faz — sem ele o
  // pedido aparece pago sem nenhum pagamento no relatório.
  await supabase.from("payments").upsert({
    orderId, mpPaymentId: `CREDITO-${orderId}`, mpStatus: "approved", status: "PAID",
    amount: 0, productId, paidAt: agora, updatedAt: agora,
  }, { onConflict: "orderId" })

  // Mesma preparação dos caminhos pagos: photo_token e e-mail "aprove a letra".
  await ensurePaymentPrep(supabase, orderId)

  return NextResponse.json({ success: true, creditosUsados: custo })
}
