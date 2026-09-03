import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { createServerClient } from "@/lib/supabase"
import { getComposerSettings } from "@/lib/composer/settings"
import { buildSessionContext } from "@/lib/composer/context"
import { generateLyrics } from "@/lib/composer/gemini"
import { extrairRefrao } from "@/lib/composer/refrao"
import { extractClientIp } from "@/lib/geoip"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Gemini lento é pior que Gemini fora: spinner eterno na tela de resumo trava a
// compra. Estourou, a tela cai no estado calmo e o botão de finalizar segue.
//
// 25s medindo: a geração isolada ficou entre 4,5s e 8,7s (3 execuções) e pela
// rota entre 7s e 9s. Comecei com 15s e vi geração legítima ser cortada, o que
// é o pior dos mundos — perde a prévia depois de já ter pago a chamada. Aqui a
// folga é barata: quem espera vê a animação de composição; quem é cortado perde
// o encantamento.
const TIMEOUT_MS = 25_000

// A letra INTEIRA nunca sai daqui — só o refrão. Borrar o resto no navegador
// não protege nada (F12 e a pessoa lê tudo), então o que a tela borra é texto
// decorativo fixo, não a continuação real da música.
type Previa = {
  assinatura: string
  refrao: string
  letra: string
  geracoes: number
  em: string
}

const hashIp = (ip: string) =>
  createHash("sha256")
    .update(`${process.env.PREVIEW_IP_SALT ?? "fizmusica-previa"}:${ip}`)
    .digest("hex")

const hoje = () => new Date().toISOString().slice(0, 10)

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json().catch(() => ({}))
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ status: "erro" }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: sessao } = await supabase
    .from("wizard_sessions")
    .select("id, data")
    .eq("id", sessionId)
    .maybeSingle()

  if (!sessao) return NextResponse.json({ status: "erro" }, { status: 404 })

  const dados = (sessao.data ?? {}) as Record<string, any>
  const contexto = await buildSessionContext(dados)
  if (!contexto) return NextResponse.json({ status: "erro" }, { status: 400 })

  const assinatura = createHash("sha256").update(contexto).digest("hex")
  const previa = dados.previa as Previa | undefined
  const settings = await getComposerSettings()

  // Mesma história de antes: devolve o que já foi gerado. Ir e voltar na tela
  // conferindo não custa chamada nem consome teto.
  if (previa?.assinatura === assinatura && previa.refrao) {
    return NextResponse.json({ status: "ok", refrao: previa.refrao })
  }

  // Daqui pra baixo a história mudou (ou é a primeira vez), então precisa gerar
  // de novo — mostrar o refrão guardado agora seria mostrar a música de um
  // texto que a pessoa já corrigiu.
  const usadas = previa?.geracoes ?? 0
  if (usadas >= settings.previewMaxSession) {
    return NextResponse.json({ status: "limite" })
  }

  const ip = extractClientIp(req.headers)
  const ipHash = ip ? hashIp(ip) : null
  const dia = hoje()

  if (ipHash) {
    const { data: linha } = await supabase
      .from("preview_rate_limit")
      .select("count")
      .eq("ip_hash", ipHash)
      .eq("day", dia)
      .maybeSingle()

    if ((linha?.count ?? 0) >= settings.previewMaxIpDay) {
      return NextResponse.json({ status: "limite" })
    }
  }

  let letra: string
  try {
    letra = await Promise.race([
      generateLyrics({
        systemPrompt: settings.prompt,
        model: settings.model,
        location: settings.location,
        userContent: contexto,
        // Sem pensar: aqui é o visitante esperando ANTES de comprar, a etapa
        // mais cara de perder. Pensando, a geração ia de 9,7s a 74,4s e batia
        // no timeout desta rota; sem pensar fica em 3-4s. Ver a medição em
        // lib/composer/gemini.ts.
        pensar: false,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
      ),
    ])
  } catch (e) {
    // Falha não grava rascunho, não conta no teto e não incrementa o IP: se o
    // Gemini voltar enquanto a pessoa ainda está na tela, ela consegue ver.
    console.error("[previa-letra]", e instanceof Error ? e.message : e)
    return NextResponse.json({ status: "erro" })
  }

  const refrao = extrairRefrao(letra)
  if (!refrao.trim()) {
    console.error("[previa-letra] letra gerada sem refrão extraível")
    return NextResponse.json({ status: "erro" })
  }

  const nova: Previa = {
    assinatura,
    refrao,
    letra: letra.trim(),
    geracoes: usadas + 1,
    em: new Date().toISOString(),
  }

  await supabase
    .from("wizard_sessions")
    .update({ data: { ...dados, previa: nova }, updated_at: new Date().toISOString() })
    .eq("id", sessionId)

  if (ipHash) {
    // Leitura-e-escrita sem transação: duas abas simultâneas podem render uma
    // prévia a mais que o teto. Tudo bem — isto é rede contra script, não
    // cobrança, e errar pra frouxo aqui é muito mais barato que barrar cliente.
    const { data: atual } = await supabase
      .from("preview_rate_limit")
      .select("count")
      .eq("ip_hash", ipHash)
      .eq("day", dia)
      .maybeSingle()

    await supabase
      .from("preview_rate_limit")
      .upsert(
        { ip_hash: ipHash, day: dia, count: (atual?.count ?? 0) + 1, updated_at: new Date().toISOString() },
        { onConflict: "ip_hash,day" }
      )
  }

  return NextResponse.json({ status: "ok", refrao })
}
