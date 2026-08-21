import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const { id } = await params

  const { nome, ocasiaoEmoji, ocasiaoLabel, data } = await req.json().catch(() => ({}))
  const cleanNome = String(nome ?? "").trim()
  if (!cleanNome || !ocasiaoEmoji || !ocasiaoLabel || !data) {
    return NextResponse.json({ error: "Preencha nome, ocasião e data." }, { status: 400 })
  }

  const supabase = createServerClient()
  // Editar a data reabre a janela do lembrete (fase 2): zera o ano já
  // avisado, senão uma data adiada nunca mais dispararia o aviso.
  const { data: row, error } = await supabase
    .from("special_dates")
    .update({ nome: cleanNome, ocasiao_emoji: ocasiaoEmoji, ocasiao_label: ocasiaoLabel, data, last_reminder_sent_for_year: null })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, nome, ocasiao_emoji, ocasiao_label, data")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ date: row })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const { id } = await params

  const supabase = createServerClient()
  // Filtra por user_id também: garante que ninguém apaga data especial de outra conta.
  const { error } = await supabase
    .from("special_dates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
