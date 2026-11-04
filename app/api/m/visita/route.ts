import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// Registra a abertura de um player. Chamado pelo navegador (sendBeacon), não
// pela página: a página do player é cacheada, e contar lá dentro faria o
// número despencar junto com o cache.
//
// Deliberadamente minúscula — é uma chamada de função por visita, e foi
// criada justamente para SUBSTITUIR uma invocação muito mais cara (a página
// inteira, com 5 consultas e a renderização do player). Nada de autenticação,
// nada de leitura extra: só o incremento.
//
// `views` é a abertura do link, não a reprodução. São métricas diferentes e
// continuam separadas: a escuta é contada no `onPlay`, no cliente.
export async function POST(req: NextRequest) {
  return contar(req)
}

// `sendBeacon` manda POST, mas o fallback e alguns navegadores antigos usam
// GET. Aceitar os dois evita perder contagem por detalhe de transporte.
export async function GET(req: NextRequest) {
  return contar(req)
}

async function contar(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim()
  // Resposta vazia sempre, inclusive sem slug: quem chama é um beacon, que
  // ignora o corpo. Devolver erro só geraria ruído no console de quem ouve.
  if (!slug) return new NextResponse(null, { status: 204 })

  const supabase = createServerClient()
  const { error } = await supabase.rpc("increment_music_views", { p_slug: slug })
  if (error) console.error("[visita] falha ao contar", slug, error.message)

  return new NextResponse(null, { status: 204 })
}
