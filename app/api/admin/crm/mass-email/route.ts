import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { sendMassEmail } from "@/app/services/emailService"

// POST — envia e-mail em massa para clientes selecionados
export async function POST(req: NextRequest) {
  const { audience, subject, body } = await req.json()

  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Assunto e corpo são obrigatórios" }, { status: 400 })
  }

  const supabase = createServerClient()

  // audience: "paid" | "all"
  let query = supabase
    .from("orders")
    .select("nome, email")
    .order("createdAt", { ascending: false })

  if (audience === "paid") {
    query = query.eq("paymentStatus", "PAID")
  }

  const { data: orders } = await query

  if (!orders?.length) {
    return NextResponse.json({ error: "Nenhum destinatário encontrado" }, { status: 400 })
  }

  // Deduplica por e-mail (pega o mais recente)
  const seen = new Set<string>()
  const recipients = orders
    .filter(o => { if (seen.has(o.email)) return false; seen.add(o.email); return true })
    .map(o => ({ nome: o.nome, email: o.email }))

  const result = await sendMassEmail(recipients, subject, body)
  return NextResponse.json(result)
}

// GET — retorna contagem de destinatários por audiência
export async function GET(req: NextRequest) {
  const audience = req.nextUrl.searchParams.get("audience") ?? "paid"
  const supabase = createServerClient()

  let query = supabase.from("orders").select("email")
  if (audience === "paid") query = query.eq("paymentStatus", "PAID")

  const { data } = await query
  const unique = new Set((data ?? []).map(o => o.email)).size
  return NextResponse.json({ count: unique })
}
