import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { randomUUID } from "crypto"

export const dynamic = "force-dynamic"

// Cria o pedido de um PACOTE pré-pago e devolve o orderId para o checkout.
//
// Rota separada de `POST /api/orders` de propósito: aquele schema exige
// ocasião, estilo, voz, emoção e pelo menos uma resposta do wizard, e um
// pacote não tem nada disso — ele não é uma música, é saldo.
//
// NÃO exige login. O crédito vive em `user_id`, então alguém precisa ser dono —
// mas essa conta nasce DEPOIS do pagamento, pelo e-mail que a pessoa já
// informou no wizard (ver `donoDoSaldo` em lib/credits.ts). Exigir login antes
// era uma parede na cara de quem só queria comprar, e no momento errado: a
// pessoa ainda não tinha motivo nenhum pra criar conta.
//
// Quem JÁ está logado continua mandando o token, e aí o pedido já nasce com
// dono — é o caminho da recarga de quem é cliente.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null

  let user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null = null
  if (token) {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: userData } = await anon.auth.getUser(token)
    user = userData?.user ?? null
  }

  const { productId, pedidoPendente } = await req.json().catch(() => ({}))
  if (!productId) return NextResponse.json({ error: "Produto não informado." }, { status: 400 })

  const supabase = createServerClient()
  const { data: produto } = await supabase
    .from("products")
    .select("id, name, price, active, credits_granted")
    .eq("id", productId)
    .maybeSingle()

  if (!produto || !produto.active) {
    return NextResponse.json({ error: "Pacote indisponível." }, { status: 404 })
  }
  // Trava de segurança: sem isto, um productId trocado na requisição faria o
  // caminho do pacote vender qualquer plano sem letra nem entrega.
  if (!produto.credits_granted || produto.credits_granted <= 0) {
    return NextResponse.json({ error: "Este produto não é um pacote." }, { status: 400 })
  }

  // O pedido de música que motivou a compra, quando ela parte do funil
  // (/produtos). Guardado no pedido do PACOTE para que, ao creditar, 1 dos
  // créditos pague esse pedido na hora.
  //
  // Validado aqui e não aceito de olhos fechados: é um id vindo do cliente, e
  // sem conferir daria para pendurar o pacote no pedido de outra pessoa e
  // pagar a música dela. As três condições são o que define "pedido de música
  // meu e ainda em aberto".
  let vinculo: string | null = null
  // Identidade do pedido de pacote. Com login vem da conta; sem login, do
  // pedido de música que a pessoa acabou de montar no wizard — é de lá que
  // sai o e-mail que vai virar a conta dona do saldo.
  let identidade = {
    nome: (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split("@")[0] ?? "Cliente",
    email: user?.email ?? "",
    whatsapp: "",
  }

  if (pedidoPendente) {
    const { data: pend } = await supabase
      .from("orders")
      .select("id, userId, email, nome, whatsapp, paymentStatus, musicalStyle, voiceType, emotion, products(credits_granted)")
      .eq("id", String(pedidoPendente))
      .maybeSingle()

    const prod = Array.isArray(pend?.products) ? pend?.products[0] : pend?.products
    const ehPacote = Number((prod as { credits_granted?: number | null } | null)?.credits_granted ?? 0) > 0
    const temBrief = !!pend && [pend.musicalStyle, pend.voiceType, pend.emotion]
      .some((v) => String(v ?? "").trim() !== "")
    // Sem login, o pedido pendente é a ÚNICA identidade que existe — e ele veio
    // do wizard desta mesma sessão. Logado, vale a regra de sempre: meu por
    // `userId`, ou por e-mail quando o pedido ainda não foi vinculado.
    const meu = !!pend && (
      !user ||
      pend.userId === user.id ||
      (pend.userId === null && (pend.email ?? "").trim().toLowerCase() === (user.email ?? "").trim().toLowerCase())
    )

    if (pend && meu && pend.paymentStatus !== "PAID" && !ehPacote && temBrief) {
      vinculo = pend.id
      // Sem login é daqui que sai a identidade. Com login a conta manda, pra
      // não trocar o dono do saldo por um e-mail digitado no wizard.
      if (!user) {
        identidade = {
          nome: pend.nome || identidade.nome,
          email: (pend.email ?? "").trim().toLowerCase(),
          whatsapp: pend.whatsapp ?? "",
        }
      }
    } else {
      // Não é erro: a compra do pacote segue de pé, só sem o débito
      // automático. Recusar a venda porque o vínculo não serve seria pior.
      console.warn("[creditos] pedido pendente recusado como vínculo:", pedidoPendente)
    }
  }

  // Sem login E sem pedido pendente não existe e-mail nenhum — e aí o saldo
  // realmente não teria a quem pertencer. Este é o único caso que ainda pede
  // conta, e ele não acontece pelos caminhos da tela (home e /produtos sempre
  // trazem o pedido do wizard).
  if (!identidade.email) {
    return NextResponse.json(
      { error: "Entre na sua conta para comprar um pacote." },
      { status: 401 },
    )
  }

  const agora = new Date().toISOString()
  const orderId = randomUUID()

  // `email`, `whatsapp` e `emotion` são NOT NULL na tabela e vão como string
  // vazia — mesmo caminho que os pedidos de vitrine já usam. `lyricsApproved`
  // fica falso, e é isso que mantém o pacote fora da tela de produção, que
  // filtra por ele.
  const { error } = await supabase.from("orders").insert({
    id: orderId,
    createdAt: agora,
    updatedAt: agora,
    nome: identidade.nome,
    email: identidade.email,
    whatsapp: identidade.whatsapp,
    emotion: "",
    context: "Pacote de músicas",
    subcategory: produto.name,
    musicalStyle: "",
    voiceType: "",
    status: "PENDING",
    paymentStatus: "UNPAID",
    productId: produto.id,
    // Pode nascer sem dono: a conta é resolvida (ou criada) ao creditar, pelo
    // e-mail. Ver `donoDoSaldo` em lib/credits.ts.
    userId: user?.id ?? null,
    honoree_consent: false,
    is_revision: false,
    recovery_stage: 0,
    lyricsApproved: false,
    lyricsReprocessCount: 0,
    ...(vinculo ? { pacote_para_pedido: vinculo } : {}),
  })

  if (error) {
    console.error("[creditos] falha ao criar pedido de pacote", error.message)
    return NextResponse.json({ error: "Não foi possível iniciar a compra." }, { status: 500 })
  }

  return NextResponse.json({
    orderId,
    productId: produto.id,
    productName: produto.name,
    price: Number(produto.price),
    credits: produto.credits_granted,
    // O cliente usa isto para saber se vai voltar para a música ou para a
    // tela do pacote depois de pagar.
    pedidoVinculado: vinculo,
  })
}
