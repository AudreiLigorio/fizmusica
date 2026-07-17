import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { sendAccessLinksEmail } from "@/app/services/emailService"

export const dynamic = "force-dynamic"

// Freio simples de repetição por e-mail (por instância). Mesmo limitado, a
// resposta continua genérica — quem abusa não descobre nada.
const recentSends = new Map<string, number>()
const RESEND_COOLDOWN_MS = 60_000

function isRateLimited(email: string): boolean {
  const now = Date.now()
  const last = recentSends.get(email) ?? 0
  if (now - last < RESEND_COOLDOWN_MS) return true
  recentSends.set(email, now)
  if (recentSends.size > 1000) {
    for (const [k, v] of recentSends) if (now - v > RESEND_COOLDOWN_MS) recentSends.delete(k)
  }
  return false
}

// "Perdi o e-mail com meu link": reenvia os links de token (/preparar/[token])
// dos pedidos PAGOS desse e-mail — pro PRÓPRIO e-mail do pedido, nunca pra
// terceiros. Resposta sempre genérica (não revela se o e-mail tem pedidos).
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}))
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : ""
  if (!normalized || !normalized.includes("@")) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 })
  }

  const generic = NextResponse.json({ ok: true })
  if (isRateLimited(normalized)) return generic

  const supabase = createServerClient()
  const { data: orders } = await supabase
    .from("orders")
    .select("id, nome, subcategory, honoreeName, photo_token, createdAt")
    .ilike("email", normalized)
    .eq("paymentStatus", "PAID")
    .not("photo_token", "is", null)
    .order("createdAt", { ascending: false })
    .limit(5)

  if (!orders?.length) return generic

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"
  const r = await sendAccessLinksEmail({
    email: normalized,
    nome:  orders[0].nome ?? null,
    orders: orders.map((o) => ({
      label: `${o.subcategory ?? "Música"}${o.honoreeName ? ` para ${o.honoreeName}` : ""} · #${o.id.slice(0, 8).toUpperCase()}`,
      url:   `${baseUrl}/preparar/${o.photo_token}`,
    })),
  })
  if (!r.ok) console.error("[acesso/reenviar] envio falhou:", r.error)

  return generic
}
