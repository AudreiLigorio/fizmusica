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

  // `previa` (rascunho da letra + contador de gerações) é estado do SERVIDOR: o
  // cliente não conhece esse campo e manda o `data` inteiro a cada gravação, o
  // que apagaria o contador e o rascunho a cada clique — na prática zerando o
  // teto de gerações e permitindo prévia infinita. Preserva sempre o que já
  // está gravado; a rota da prévia é a única que escreve ali.
  const { data: atual } = await supabase
    .from("wizard_sessions")
    .select("data")
    .eq("id", id)
    .maybeSingle()

  const previa = (atual?.data as Record<string, unknown> | null)?.previa
  const merged = previa ? { ...(data ?? {}), previa } : data

  const { error } = await supabase
    .from("wizard_sessions")
    .update({ step, data: merged, updated_at: new Date().toISOString() })
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
