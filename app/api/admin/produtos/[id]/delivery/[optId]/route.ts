import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

type Params = Promise<{ id: string; optId: string }>

// PATCH — atualiza opção
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const { optId } = await params
  const body = await req.json()
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("product_delivery_options")
    .update(body)
    .eq("id", optId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ option: data })
}

// DELETE — remove opção
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const { optId } = await params
  const supabase = createServerClient()

  const { error } = await supabase
    .from("product_delivery_options")
    .delete()
    .eq("id", optId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
