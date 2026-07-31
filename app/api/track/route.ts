import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const EVENTOS = new Set(["pageview", "cta_criar", "wizard_passo", "checkout", "pago"])

// Coletor de eventos do site. Público por natureza (o navegador do visitante
// chama), então: lista fechada de eventos, tamanho limitado e NADA de dado
// pessoal — sem IP, sem user agent. O id de sessão é anônimo e serve só pra
// ligar os passos de uma mesma visita.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}))
    if (!b?.sessao || !EVENTOS.has(b.evento)) {
      return NextResponse.json({ ok: false }, { status: 204 })
    }

    const corta = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null)

    await createServerClient().from("site_events").insert({
      sessao: String(b.sessao).slice(0, 64),
      evento: b.evento,
      caminho: corta(b.caminho, 200),
      detalhe: corta(b.detalhe, 120),
      utm_source: corta(b.utm_source, 80),
      utm_medium: corta(b.utm_medium, 80),
      utm_campaign: corta(b.utm_campaign, 120),
      utm_content: corta(b.utm_content, 120),
      referrer: corta(b.referrer, 200),
    })

    return NextResponse.json({ ok: true })
  } catch {
    // Telemetria nunca pode atrapalhar o site do cliente.
    return NextResponse.json({ ok: false }, { status: 204 })
  }
}
