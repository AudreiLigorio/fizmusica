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
// EXIGE CONTA, e isso não é comodidade: o crédito vive em `user_id`. Sem dono
// não há a quem creditar, e a pessoa teria pago por um saldo que não existe
// em lugar nenhum. O checkout sem conta continua valendo para música; para
// pacote, não.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: "Entre na sua conta para comprar um pacote." }, { status: 401 })

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: userData, error: authErr } = await anon.auth.getUser(token)
  if (authErr || !userData.user) {
    return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 })
  }
  const user = userData.user

  const { productId } = await req.json().catch(() => ({}))
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
    nome: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Cliente",
    email: user.email ?? "",
    whatsapp: "",
    emotion: "",
    context: "Pacote de músicas",
    subcategory: produto.name,
    musicalStyle: "",
    voiceType: "",
    status: "PENDING",
    paymentStatus: "UNPAID",
    productId: produto.id,
    userId: user.id,
    honoree_consent: false,
    is_revision: false,
    recovery_stage: 0,
    lyricsApproved: false,
    lyricsReprocessCount: 0,
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
  })
}
