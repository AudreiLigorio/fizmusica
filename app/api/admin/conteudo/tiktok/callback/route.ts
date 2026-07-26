import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, TIKTOK_STATE_COOKIE } from "@/lib/content/publishers/tiktok-auth"

export const dynamic = "force-dynamic"

function redirectUri() {
  return `${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/conteudo/tiktok/callback`
}

function backToAdmin(req: NextRequest, status: "conectado" | "erro", message?: string) {
  const url = new URL("/admin/conteudo", req.url)
  url.searchParams.set("tiktok", status)
  if (message) url.searchParams.set("tiktok_msg", message)
  const res = NextResponse.redirect(url)
  res.cookies.set(TIKTOK_STATE_COOKIE, "", { maxAge: 0, path: "/" })
  return res
}

// Callback do Login Kit: o TikTok redireciona o navegador do admin pra cá
// depois da autorização. Verifica o state anti-CSRF, troca o code pelos
// tokens e volta pro /admin/conteudo.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const error = searchParams.get("error")
  if (error) {
    return backToAdmin(req, "erro", searchParams.get("error_description") ?? error)
  }

  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const expectedState = req.cookies.get(TIKTOK_STATE_COOKIE)?.value

  if (!code || !state || !expectedState || state !== expectedState) {
    return backToAdmin(req, "erro", "Falha na verificação de segurança (state).")
  }

  try {
    await exchangeCodeForTokens(code, redirectUri())
    return backToAdmin(req, "conectado")
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao conectar com o TikTok."
    return backToAdmin(req, "erro", msg)
  }
}
