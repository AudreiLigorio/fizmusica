import { NextRequest, NextResponse } from "next/server"
import { createAdminToken, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/admin-auth"

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 500 })
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 })
  }

  const token = await createAdminToken()

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" })
  return res
}
