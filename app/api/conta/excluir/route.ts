import { NextRequest, NextResponse, after } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { excluirConta, pedidosEmAndamento } from "@/lib/excluirConta"
import { sendAccountDeletedEmail } from "@/app/services/emailService"

export const dynamic = "force-dynamic"

async function getUserFromAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

// Consulta antes de mostrar a confirmação: se houver música em produção, a tela
// já explica o bloqueio em vez de deixar a pessoa digitar EXCLUIR à toa.
export async function GET(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const pedidos = await pedidosEmAndamento(user.id, user.email ?? null)
  return NextResponse.json({ pedidosEmAndamento: pedidos })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  // A palavra digitada é conferida aqui também — não só na tela.
  if (String(body.confirmacao ?? "").trim().toUpperCase() !== "EXCLUIR") {
    return NextResponse.json({ error: "Digite EXCLUIR para confirmar." }, { status: 400 })
  }

  const r = await excluirConta(user.id, user.email ?? null)
  if (!r.ok && r.motivo === "pedido_em_andamento") {
    return NextResponse.json({ error: "pedido_em_andamento", pedidos: r.pedidos }, { status: 409 })
  }
  if (!r.ok) {
    console.error("[excluir-conta]", user.id, r.detalhe)
    return NextResponse.json({ error: "Não foi possível excluir agora. Tente de novo em instantes." }, { status: 500 })
  }

  // Aviso por e-mail: se não foi a própria pessoa (sessão aberta num aparelho
  // de outro), ela fica sabendo na hora.
  if (user.email) after(() => sendAccountDeletedEmail({ email: user.email! }).then(() => {}))
  return NextResponse.json({ ok: true })
}
