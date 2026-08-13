import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Duas exceções, e só duas:
  // - /admin/login e /api/admin/auth: é onde a senha é conferida. Exigir sessão
  //   aqui deixaria o admin sem como entrar.
  // - callback do TikTok: quem redireciona o navegador pra cá é o TikTok, e a
  //   rota já se protege sozinha com o `state` anti-CSRF (sem code+state
  //   casando, ela recusa). Deixar de fora evita quebrar a conexão por um
  //   detalhe de SameSite no retorno de outro domínio.
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/auth") ||
    pathname === "/api/admin/conteudo/tiktok/callback"
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const valid = token ? await verifyAdminToken(token) : false

  if (!valid) {
    // Rota de API responde 401 em JSON. Redirecionar devolveria o HTML da tela
    // de login com status 200 pro fetch() do painel, que trataria a página de
    // login como "deu certo" — falha silenciosa pior que o erro.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
    }
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = "/admin/login"
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

// As rotas de API do admin ficavam DE FORA deste matcher: `/api/admin/...` não
// começa com `/admin/`. Na prática, 23 rotas que mudam preço, criam cupom,
// entregam pedido e disparam e-mail em massa estavam abertas na internet.
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
}
