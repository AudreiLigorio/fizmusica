import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // sem chars ambíguos
  let s = ""
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export async function GET() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("coupons")
    .select("*")
    .order("createdAt", { ascending: false })
  return NextResponse.json({ coupons: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const code = (body.code?.trim() || randomCode()).toUpperCase()
  const type = body.type === "FIXED" ? "FIXED" : "PERCENT"
  const value = Number(body.value)

  if (!value || value <= 0) return NextResponse.json({ error: "Valor inválido." }, { status: 400 })
  if (type === "PERCENT" && value > 100) return NextResponse.json({ error: "Percentual não pode passar de 100%." }, { status: 400 })

  const { data, error } = await supabase
    .from("coupons")
    .insert({
      code,
      type,
      value,
      min_value:    body.min_value ? Number(body.min_value) : null,
      max_uses:     body.max_uses ? Number(body.max_uses) : null,
      expires_at:   body.expires_at || null,
      description:  body.description?.trim() || null,
      show_on_site: !!body.show_on_site,
      active:       body.active !== false,
    })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Já existe um cupom com esse código." }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ coupon: data })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const supabase = createServerClient()
  if (!body.id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (typeof body.active === "boolean")       update.active = body.active
  if (typeof body.show_on_site === "boolean") update.show_on_site = body.show_on_site

  const { error } = await supabase.from("coupons").update(update).eq("id", body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const supabase = createServerClient()
  if (!body.id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 })
  await supabase.from("coupons").delete().eq("id", body.id)
  return NextResponse.json({ ok: true })
}
