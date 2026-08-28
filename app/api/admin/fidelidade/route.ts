import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// Painel de fidelidade do admin: níveis configuráveis + números do programa.
//
// Os percentuais e faixas vivem no banco porque a spec é explícita: "regras e
// faixas configuráveis no admin, não no código". Mexer em desconto não pode
// exigir deploy.
export async function GET() {
  const supabase = createServerClient()

  const { data: niveis } = await supabase
    .from("loyalty_levels")
    .select("id, nome, icone, min_discos, desconto_digital, desconto_fisico, ativo")
    .order("min_discos", { ascending: true })

  // Achado do Audrei (2026-08-27): antes o disco valia fixo por categoria —
  // Essencial (R$15,90) e Retrospectiva premium (R$89,90) rendiam o mesmo.
  // Agora cada produto tem seu próprio valor (migração 055), editável aqui.
  const { data: produtos } = await supabase
    .from("products")
    .select("id, name, category, price, active, loyalty_discos")
    .order("price", { ascending: true })

  const { data: txs } = await supabase
    .from("loyalty_transactions")
    .select("user_id, tipo, discos")

  // Saldo por cliente — mesma conta do lado do cliente (soma das transações),
  // pra os dois nunca discordarem sobre quem está em que nível.
  const saldo: Record<string, number> = {}
  for (const t of txs ?? []) {
    const u = t.user_id as string
    saldo[u] = (saldo[u] ?? 0) + (t.discos as number)
  }

  const faixas = (niveis ?? []).filter((n) => n.ativo)
  function nivelDe(discos: number) {
    let atual = faixas[0]
    for (const n of faixas) if (discos >= (n.min_discos as number)) atual = n
    return atual
  }

  const porNivel: Record<string, number> = {}
  for (const d of Object.values(saldo)) {
    const n = nivelDe(Math.max(0, d))
    if (!n) continue
    const chave = `${n.icone} ${n.nome}`
    porNivel[chave] = (porNivel[chave] ?? 0) + 1
  }

  const porOrigem: Record<string, number> = {}
  for (const t of txs ?? []) {
    const tipo = t.tipo as string
    porOrigem[tipo] = (porOrigem[tipo] ?? 0) + (t.discos as number)
  }

  return NextResponse.json({
    niveis: niveis ?? [],
    produtos: produtos ?? [],
    resumo: {
      clientes: Object.keys(saldo).length,
      discosDistribuidos: Object.values(saldo).reduce((a, b) => a + b, 0),
      porNivel,
      porOrigem,
    },
  })
}

// Edita um nível OU o valor em discos de um produto (discriminado por
// `produtoId` no corpo — dois formulários diferentes na mesma tela, mais
// simples que duas rotas pra um painel deste tamanho).
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  if ("produtoId" in body) {
    const produtoId = String(body.produtoId ?? "").trim()
    if (!produtoId) return NextResponse.json({ error: "Produto inválido." }, { status: 400 })
    const discos = Math.max(0, Math.round(Number(body.discos) || 0))
    const supabase = createServerClient()
    const { error } = await supabase.from("products").update({ loyalty_discos: discos }).eq("id", produtoId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const id = Number(body.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Nível inválido." }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ("nome" in body) patch.nome = String(body.nome).trim().slice(0, 40)
  if ("minDiscos" in body) patch.min_discos = Math.max(0, Number(body.minDiscos) || 0)
  if ("descontoDigital" in body) patch.desconto_digital = clampPct(body.descontoDigital)
  if ("descontoFisico" in body) patch.desconto_fisico = clampPct(body.descontoFisico)
  if ("ativo" in body) patch.ativo = !!body.ativo

  const supabase = createServerClient()
  const { error } = await supabase.from("loyalty_levels").update(patch).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Trava de segurança comercial: desconto acima de 100% inverteria o pagamento,
// e negativo cobraria a mais. Não confiar no formulário.
function clampPct(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}
