import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { gerarNarracao, type VozId } from "@/lib/content/narracao"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Prévia da narração: devolve o áudio na resposta e NÃO salva nada. É pra
// ouvir antes de gastar uma renderização inteira descobrindo que o texto
// ficou comprido demais — prévia que vira arquivo no bucket seria lixo
// acumulando a cada tentativa.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const { texto, voz } = await req.json().catch(() => ({}))
  if (!texto?.trim()) {
    return NextResponse.json({ error: "Escreva o texto da narração." }, { status: 400 })
  }

  try {
    const wav = await gerarNarracao(texto, (voz ?? "Kore") as VozId)
    return new Response(new Uint8Array(wav), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao gerar a prévia." },
      { status: 500 },
    )
  }
}
