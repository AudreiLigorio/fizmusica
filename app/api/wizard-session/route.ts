import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// GET /api/wizard-session?id=UUID
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("wizard_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}

// POST /api/wizard-session — cria nova sessão
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, step, data } = body

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase
    .from("wizard_sessions")
    .insert({ id, step: step ?? 1, data: data ?? {} })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PUT /api/wizard-session — atualiza sessão existente
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, step, data } = body

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase
    .from("wizard_sessions")
    .update({ step, data, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/wizard-session?id=UUID — remove sessão após pedido finalizado
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const supabase = createServerClient()
  await supabase.from("wizard_sessions").delete().eq("id", id)
  return NextResponse.json({ ok: true })
}
