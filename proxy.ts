import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Permite acesso à página de login e à API de auth
  if (pathname === "/admin/login" || pathname.startsWith("/api/admin/auth")) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const valid = token ? await verifyAdminToken(token) : false

  if (!valid) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = "/admin/login"
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
