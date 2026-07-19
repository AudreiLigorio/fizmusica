import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

// GET — lista opções de prazo de um produto
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("product_delivery_options")
    .select("*")
    .eq("product_id", id)
    .order("sort_order", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ options: data })
}

// PATCH — ação em massa: liga/desliga TODAS as opções do produto de uma vez.
// Serve pro interruptor mestre de prazos: sem nenhuma opção ativa, o cliente
// compra em 1 clique (a /produtos pula a etapa de escolher prazo).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Campo 'active' (boolean) obrigatório." }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from("product_delivery_options")
    .update({ active: body.active })
    .eq("product_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST — cria nova opção
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("product_delivery_options")
    .insert({ ...body, product_id: id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ option: data })
}
