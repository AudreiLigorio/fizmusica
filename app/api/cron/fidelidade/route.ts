import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { concederDiscosDoPedido } from "@/lib/fidelidade"

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
    .select("id")
    .eq("paymentStatus", "PAID")
    .not("userId", "is", null)
    .limit(500)

  let concedidos = 0
  for (const o of pagos ?? []) {
    if (await concederDiscosDoPedido(supabase, o.id as string)) concedidos++
  }

  return NextResponse.json({
    ok: true,
    analisados: pagos?.length ?? 0,
    concedidos,
    jaTinham: (pagos?.length ?? 0) - concedidos,
  })
}
