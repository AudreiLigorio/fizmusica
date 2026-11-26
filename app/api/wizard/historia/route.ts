import { NextRequest, NextResponse, after } from "next/server"
import { createHash } from "crypto"
import { createServerClient } from "@/lib/supabase"
import { classificarHistoria } from "@/lib/composer/classificarHistoria"
import { getComposerSettings } from "@/lib/composer/settings"
import { extractClientIp } from "@/lib/geoip"
import { HISTORIA_MIN, HISTORIA_MAX } from "@/lib/wizardHistoria"

export const dynamic = "force-dynamic"
export const maxDuration = 30

// Wizard "campo primeiro" (versão B do teste A/B — ver lib/wizardHistoria.ts).
//
// POST { historia, nome, dica? } → { ok: true, context, subcategory, pergunta }
//                                  { ok: false }  (o wizard pede o tema numa lista)
//
// Pública (o visitante ainda não deu dado nenhum), então tem teto por IP por
// dia, igual à prévia da letra e na MESMA tabela (preview_rate_limit), com a
// chave separada ("historia:" no hash) pra uma não consumir o teto da outra.
// O teto é o mesmo número configurado pra prévia no admin (Compositor).
// Nada da história é gravado aqui: ela vai pra sessão do wizard pelo caminho
// de sempre (/api/wizard-session).

const hashIp = (ip: string) =>
  createHash("sha256")
    .update(`${process.env.PREVIEW_IP_SALT ?? "fizmusica-previa"}:historia:${ip}`)
    .digest("hex")

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const historia = typeof b?.historia === "string" ? b.historia.trim() : ""
  const nome = typeof b?.nome === "string" ? b.nome.trim().slice(0, 80) : ""
  const dica = typeof b?.dica === "string" ? b.dica.trim().slice(0, 40) : null

  if (historia.length < HISTORIA_MIN || historia.length > HISTORIA_MAX || !nome) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const supabase = createServerClient()
  const ip = extractClientIp(req.headers)
  const ipHash = ip ? hashIp(ip) : null
  const dia = new Date().toISOString().slice(0, 10)

  // Teto e classificação EM PARALELO: quem espera é o visitante na 1ª tela,
  // e consulta em fila somava ~1-2s ao tempo do Gemini. Se o teto já estourou
  // a classificação é descartada (custo de uma chamada barata, só pra quem
  // passou de N histórias no dia).
  const [usadas, r] = await Promise.all([
    ipHash
      ? Promise.all([
          getComposerSettings(),
          supabase.from("preview_rate_limit").select("count").eq("ip_hash", ipHash).eq("day", dia).maybeSingle(),
        ]).then(([settings, { data }]) => ({ count: data?.count ?? 0, teto: settings.previewMaxIpDay }))
      : Promise.resolve(null),
    classificarHistoria({ historia, nome, dica }),
  ])
  if (usadas && usadas.count >= usadas.teto) return NextResponse.json({ ok: false })
  if (!r) return NextResponse.json({ ok: false })

  if (ipHash && usadas) {
    // Depois da resposta (não atrasa a tela). Sem transação, como na prévia:
    // é rede contra script, não cobrança.
    after(async () => {
      await supabase
        .from("preview_rate_limit")
        .upsert(
          { ip_hash: ipHash, day: dia, count: usadas.count + 1, updated_at: new Date().toISOString() },
          { onConflict: "ip_hash,day" }
        )
    })
  }

  return NextResponse.json({ ok: true, context: r.context, subcategory: r.subcategory, pergunta: r.pergunta })
}
