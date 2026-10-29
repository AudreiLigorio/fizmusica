import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { saldoDeCreditos, extratoDeCreditos } from "@/lib/credits"

export const dynamic = "force-dynamic"

// Saldo e extrato de créditos do usuário logado.
//
// Saldo invisível é saldo esquecido — e saldo esquecido é reembolso pedido
// três meses depois. A pessoa pagou por ele; tem que conseguir ver.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return NextResponse.json({ saldo: 0, extrato: [] })

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: u, error } = await anon.auth.getUser(token)
  // Sem sessão devolve saldo zero em vez de 401: quem chama é a tela, e um
  // erro aqui faria um painel de créditos aparecer quebrado para visitante.
  if (error || !u.user) return NextResponse.json({ saldo: 0, extrato: [] })

  const supabase = createServerClient()
  const [saldo, extrato] = await Promise.all([
    saldoDeCreditos(supabase, u.user.id),
    extratoDeCreditos(supabase, u.user.id, 30),
  ])
  return NextResponse.json({ saldo, extrato })
}
