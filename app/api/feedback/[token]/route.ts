import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

type Params = Promise<{ token: string }>

// GET — retorna info do pedido para a página de feedback
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { token } = await params
  const supabase  = createServerClient()

  const { data: feedback } = await supabase
    .from("feedbacks")
    .select("id, submittedAt, orders(nome, subcategory, musicalStyle)")
    .eq("token", token)
    .maybeSingle()

  if (!feedback) return NextResponse.json({ error: "Link inválido." }, { status: 404 })

  const order = feedback.orders as { nome: string; subcategory: string; musicalStyle: string } | null

  return NextResponse.json({
    alreadySubmitted: !!feedback.submittedAt,
    nome:             order?.nome         ?? "",
    subcategory:      order?.subcategory  ?? "",
    musicalStyle:     order?.musicalStyle ?? "",
  })
}

// POST — salva as respostas do formulário
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { token } = await params
  const body      = await req.json().catch(() => ({}))
  const { rating, highlight, improvement } = body as {
    rating:      number
    highlight:   string
    improvement: string
  }

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Nota inválida." }, { status: 400 })
  }
  if (!highlight?.trim()) {
    return NextResponse.json({ error: "Responda o que te encantou na música." }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from("feedbacks")
    .select("id, submittedAt")
    .eq("token", token)
    .maybeSingle()

  if (!existing)          return NextResponse.json({ error: "Link inválido."        }, { status: 404 })
  if (existing.submittedAt) return NextResponse.json({ error: "Avaliação já enviada." }, { status: 409 })

  const { error } = await supabase
    .from("feedbacks")
    .update({
      rating,
      highlight:   highlight.trim(),
      improvement: improvement?.trim() || null,
      submittedAt: new Date().toISOString(),
    })
    .eq("token", token)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
