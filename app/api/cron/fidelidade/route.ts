import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { concederDiscosDoPedido, concederDiscoDeIndicacao } from "@/lib/fidelidade"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Concede discos de pedidos pagos que nunca passaram pelos pontos de
// confirmação — os que já estavam pagos antes do programa existir, e qualquer
// um que escape por falha pontual.
//
// Existe porque a concessão acontece no momento do pagamento: sem esta
// rotina, cliente antigo entraria no programa com zero discos apesar de ter
// comprado. Idempotente (índice único order_id+tipo), então pode rodar quantas
// vezes quiser — só cria o que falta.
export async function GET(req: NextRequest) {
  // Mesma convenção das outras rotas de cron do projeto (recovery, insights):
  // o Vercel manda o CRON_SECRET no header; sem a variável, libera — é o que
  // permite rodar em desenvolvimento.
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data: pagos } = await supabase
    .from("orders")
    .select("id, referral_code")
    .eq("paymentStatus", "PAID")
    .not("userId", "is", null)
    .limit(500)

  // Quem já tem transação sai da fila ANTES do laço. Sem isso a rotina refazia
  // várias consultas por pedido em todos os 69 a cada execução — chegou a
  // derrubar o servidor de desenvolvimento. Como ela roda agendada e a maioria
  // dos pedidos já foi processada, o caminho comum tem que ser barato.
  const { data: jaFeitas } = await supabase
    .from("loyalty_transactions")
    .select("order_id, tipo")
    .in("tipo", ["PURCHASE_DIGITAL", "PURCHASE_PHYSICAL", "REFERRAL_CONVERTED"])

  const temCompra = new Set(
    (jaFeitas ?? []).filter((t) => t.tipo !== "REFERRAL_CONVERTED").map((t) => t.order_id as string),
  )
  const temIndicacao = new Set(
    (jaFeitas ?? []).filter((t) => t.tipo === "REFERRAL_CONVERTED").map((t) => t.order_id as string),
  )

  let concedidos = 0
  let indicacoes = 0
  let pulados = 0
  for (const o of pagos ?? []) {
    const id = o.id as string
    const faltaCompra = !temCompra.has(id)
    const faltaIndicacao = !!o.referral_code && !temIndicacao.has(id)
    if (!faltaCompra && !faltaIndicacao) { pulados++; continue }

    if (faltaCompra && await concederDiscosDoPedido(supabase, id)) concedidos++
    if (faltaIndicacao && await concederDiscoDeIndicacao(supabase, id)) indicacoes++
  }

  return NextResponse.json({
    ok: true,
    analisados: pagos?.length ?? 0,
    concedidos,
    indicacoes,
    jaTinham: pulados,
  })
}
