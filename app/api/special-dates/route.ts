import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// Valida o token de sessão (JWT) do Supabase e devolve o usuário logado
async function getUserFromAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function GET(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("special_dates")
    .select("id, nome, ocasiao_emoji, ocasiao_label, data")
    .eq("user_id", user.id)
    .order("data", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dates: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { nome, ocasiaoEmoji, ocasiaoLabel, data } = await req.json().catch(() => ({}))
  const cleanNome = String(nome ?? "").trim()
  if (!cleanNome || !ocasiaoEmoji || !ocasiaoLabel || !data) {
    return NextResponse.json({ error: "Preencha nome, ocasião e data." }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: row, error } = await supabase
    .from("special_dates")
    .insert({
      user_id: user.id,
      nome: cleanNome,
      ocasiao_emoji: ocasiaoEmoji,
      ocasiao_label: ocasiaoLabel,
      data,
      // Gravado aqui pra o cron de lembrete (fase 2) não precisar resolver a
      // conta de novo a cada linha — mesmo padrão de orders.email.
      email: user.email,
      conta_nome: (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined) ?? null,
    })
    .select("id, nome, ocasiao_emoji, ocasiao_label, data")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ date: row })
}
