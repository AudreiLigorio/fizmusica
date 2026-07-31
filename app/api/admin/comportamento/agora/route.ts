import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

// Quem está no site agora. "Agora" = sinal nos últimos 3 minutos: o batimento
// é de 1 em 1 minuto, então 3 dá folga para uma perda de rede sem sumir com a
// pessoa da tela.
const JANELA_MIN = 3

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const desde = new Date(Date.now() - JANELA_MIN * 60 * 1000).toISOString()
  const supabase = createServerClient()

  const { data } = await supabase
    .from("site_events")
    .select("sessao, caminho, evento, detalhe, utm_source, created_at")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(500)

  // Uma linha por pessoa, com o que ela fez por último.
  const porSessao = new Map<string, { caminho: string | null; evento: string; detalhe: string | null; origem: string; visto: string }>()
  for (const e of data ?? []) {
    if (porSessao.has(e.sessao)) continue
    porSessao.set(e.sessao, {
      caminho: e.caminho,
      evento: e.evento,
      detalhe: e.detalhe,
      origem: e.utm_source || "direto",
      visto: e.created_at,
    })
  }

  return NextResponse.json({ online: porSessao.size, pessoas: [...porSessao.values()].slice(0, 20) })
}
