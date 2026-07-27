import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// Link rastreado de conteúdo: registra o clique e manda pra landing do tema.
// Slug desconhecido cai na home em vez de 404 — o link pode já estar impresso
// numa bio ou numa descrição de vídeo, e perder a visita é pior que perder o
// registro.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data: link } = await supabase
    .from("content_links")
    .select("id, destination")
    .eq("slug", slug)
    .maybeSingle()

  if (!link) return NextResponse.redirect(new URL("/", req.url))

  // Só contagem e origem. Sem IP, sem user agent — ver migração 031.
  try {
    await supabase.from("content_link_clicks").insert({
      link_id: link.id,
      referer: req.headers.get("referer")?.slice(0, 300) ?? null,
    })
  } catch {
    // Registrar é secundário: nunca segurar o redirecionamento por causa disso.
  }

  return NextResponse.redirect(new URL(link.destination, req.url))
}
