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
