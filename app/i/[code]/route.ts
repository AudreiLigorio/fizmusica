import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const COOKIE_NAME = "fm_ref"
const COOKIE_MAX_AGE_DAYS = 30

// Etapa 2 do funil (acesso): alguém abriu o link de indicação. Grava o
// evento, marca o cookie que a criação do pedido lê depois pra atribuir a
// conversão (ver app/api/orders/route.ts), e manda pra home — não force o
// visitante direto pro wizard, ele ainda nem sabe o que é a Fiz Música.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params
  const code = rawCode.toUpperCase()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"

  const supabase = createServerClient()
  const { data: rc } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("code", code)
    .maybeSingle()

  // Código inválido: manda pra home sem gravar nada nem setar cookie.
  if (!rc) return NextResponse.redirect(new URL("/", baseUrl))

  const jaTemEsseCodigo = req.cookies.get(COOKIE_NAME)?.value === code
  if (!jaTemEsseCodigo) {
    await supabase.from("referral_events").insert({ code, type: "access" })
  }

  const res = NextResponse.redirect(new URL("/", baseUrl))
  res.cookies.set(COOKIE_NAME, code, {
    maxAge: COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
  })
  return res
}
