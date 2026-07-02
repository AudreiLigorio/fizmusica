import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, nome, email, whatsapp, status, paymentStatus, photo_token,
      context, subcategory, musicalStyle, voiceType, emotion, honoreeName,
      products ( name, price ),
      payments ( amount, status, mpStatus ),
      order_answers ( question, answer, position )
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
    // Envio físico
    "shipping_name", "shipping_cep", "shipping_address", "shipping_number",
    "shipping_complement", "shipping_neighborhood", "shipping_city",
    "shipping_state", "shipping_phone",
    // Wizard (edição via "Voltar ao wizard")
    "nome", "email", "whatsapp", "context", "subcategory",
    "musicalStyle", "voiceType", "emotion", "honoreeName",
    // Produção
    "photo_effect",
  ]
  for (const f of fields) if (f in body) allowed[f] = body[f]

  const hasAnswers = Array.isArray(body.answers) && body.answers.length > 0

  if (Object.keys(allowed).length === 0 && !hasAnswers) {
    return NextResponse.json({ error: "Nenhum campo válido." }, { status: 400 })
  }

  // Guarda: trocar e-mail só é permitido antes do pagamento (evita sequestro de
  // pedido pago por quem souber o orderId). Demais campos seguem o fluxo normal.
  if ("email" in allowed) {
    const { data: cur } = await supabase
      .from("orders").select("paymentStatus").eq("id", id).maybeSingle()
    if (cur?.paymentStatus === "PAID") {
      return NextResponse.json({ error: "Pedido já pago — e-mail não pode ser alterado aqui." }, { status: 403 })
    }
  }

  if (Object.keys(allowed).length > 0) {
    const { error } = await supabase.from("orders").update(allowed).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (hasAnswers) {
    // Substitui as respostas: apaga as antigas e insere as novas
    await supabase.from("order_answers").delete().eq("orderId", id)
    const rows = body.answers.map((a: { question: string; answer: string; position: number; context: string; subcategory: string }) => ({
      orderId: id,
      question: a.question,
      answer: a.answer,
      position: a.position,
      context: a.context,
      subcategory: a.subcategory,
    }))
    const { error: ansErr } = await supabase.from("order_answers").insert(rows)
    if (ansErr) return NextResponse.json({ error: ansErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
