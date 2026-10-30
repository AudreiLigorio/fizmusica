import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { pagarPedidoComCredito } from "@/lib/creditos/pagarPedido"

export const dynamic = "force-dynamic"

// Paga um pedido com CRÉDITO do saldo, em vez de dinheiro.
//
// Espelha `/api/payments/free` (o caminho do cupom de 100%): o Mercado Pago
// não cobra R$ 0, então marcar pago aqui é o jeito. A diferença é que ali a
// autorização vem do cupom e aqui vem do saldo do próprio usuário.
//
// O miolo (débito, estorno, registro de pagamento e preparação) mora em
// `lib/creditos/pagarPedido.ts`: a compra de pacote feita do funil precisa do
// MESMO comportamento sem passar por uma requisição. Aqui ficou só o que é
// próprio da rota — autenticar e provar que o pedido é de quem pede.
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

  const r = await pagarPedidoComCredito(supabase, { userId, orderId, productId })
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 })
  if (r.jaPago) return NextResponse.json({ success: true, jaPago: true })
  return NextResponse.json({ success: true, creditosUsados: r.creditosUsados })
}
