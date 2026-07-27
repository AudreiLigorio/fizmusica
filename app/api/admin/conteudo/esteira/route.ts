import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { rodarEsteira } from "@/lib/content/esteira"

export const dynamic = "force-dynamic"
export const maxDuration = 300

// "Rodar agora": dispara a mesma esteira do cron, ignorando o cronograma (o
// admin está pedindo na mão, então o dia da semana não importa). O teto
// semanal continua valendo — é trava de custo, não de calendário.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  try {
    const resultado = await rodarEsteira(createServerClient(), { ignorarCronograma: true })
    return NextResponse.json(resultado)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha na esteira." }, { status: 500 })
  }
}
