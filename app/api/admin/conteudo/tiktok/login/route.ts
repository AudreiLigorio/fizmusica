import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { buildAuthorizeUrl, TIKTOK_STATE_COOKIE } from "@/lib/content/publishers/tiktok-auth"

export const dynamic = "force-dynamic"

function redirectUri() {
  return `${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/conteudo/tiktok/callback`
}

// Início do Login Kit: admin clica "Conectar TikTok" no /admin/conteudo, essa
// rota gera o state anti-CSRF e redireciona pra tela de autorização do TikTok.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const state = crypto.randomBytes(16).toString("hex")
  const res = NextResponse.redirect(buildAuthorizeUrl(redirectUri(), state))
  res.cookies.set(TIKTOK_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
    secure: process.env.NODE_ENV === "production",
  })
  return res
}
