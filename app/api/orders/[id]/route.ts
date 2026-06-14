import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, nome, status, paymentStatus,
      products ( name, price ),
      payments ( amount, status, mpStatus )
    `)
    .eq("id", id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  }

  return NextResponse.json({ order: data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const supabase = createServerClient()

  const allowed: Record<string, unknown> = {}
  const fields = [
    "shipping_name", "shipping_cep", "shipping_address", "shipping_number",
    "shipping_complement", "shipping_neighborhood", "shipping_city",
    "shipping_state", "shipping_phone",
  ]
  for (const f of fields) if (f in body) allowed[f] = body[f]

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido." }, { status: 400 })
  }

  const { error } = await supabase.from("orders").update(allowed).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
