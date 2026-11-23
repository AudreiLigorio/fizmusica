import { NextRequest, NextResponse } from "next/server"
import {
  alertarFaltaDeCredito,
  checarCreditos,
  diaBrasil,
  enviarResumoCreditos,
} from "@/lib/alertaCreditos"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Checagem diária dos créditos de IA (ver lib/alertaCreditos.ts).
// Silenciosa: só escreve se houver problema. Nos dias 1 e 16 manda o resumo
// mesmo com tudo bem. `?resumo=1` força o resumo (teste manual, com o segredo).
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const estado = await checarCreditos()

    if (!estado.google.ok) await alertarFaltaDeCredito("google", estado.google.detalhe)
    if (!estado.suno.ok && estado.suno.saldo != null) {
      await alertarFaltaDeCredito("suno", estado.suno.detalhe, { saldo: estado.suno.saldo })
    }

    const forcar = req.nextUrl.searchParams.get("resumo") === "1"
    const dia = Number(diaBrasil().slice(8, 10))
    if (forcar || dia === 1 || dia === 16) await enviarResumoCreditos(estado, { forcar })

    return NextResponse.json({ ok: true, ...estado })
  } catch (e) {
    console.error("[cron/creditos]", e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "falhou" })
  }
}
