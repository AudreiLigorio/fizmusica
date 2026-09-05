import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { buildSunoStyle } from "@/lib/composer/style"

export const dynamic = "force-dynamic"
export const maxDuration = 30

type Params = Promise<{ id: string }>

const CAMPOS = "id, paymentStatus, lyricsApproved, musicalStyle, emotion, voiceType, subcategory, honoreeName, nome, revision_note, style_confirmed"

// Estilo sonoro do pedido — o que o card "Como sua música vai soar" mostra.
//
// Existe porque até agora esse texto era invisível: o buildSunoStyle rodava
// no disparo da geração, era usado e esquecido. O cliente aprovava a letra
// sem nunca saber COMO a música ia soar, e só descobria depois de pronta.
//
// Mostrar antes de gerar resolve três coisas de uma vez: ele confere o que
// a IA entendeu, corrige se estiver errado, e — o mais importante
// comercialmente — a expectativa passa a ser sobre o SOM descrito, não
// sobre um artista que o motor não consegue imitar.
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const supabase = createServerClient()

  const { data: order } = await supabase.from("orders").select(CAMPOS).eq("id", id).maybeSingle()
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  if (order.paymentStatus !== "PAID") return NextResponse.json({ error: "Pedido não está pago." }, { status: 403 })

  // Já confirmado antes: devolve o que ELE aprovou, sem reextrair. Extrair de
  // novo mudaria o texto debaixo dele a cada visita à tela.
  if (order.style_confirmed?.trim()) {
    return NextResponse.json({ estilo: order.style_confirmed.trim(), confirmado: true })
  }

  const estilo = await buildSunoStyle(order)
  return NextResponse.json({ estilo: estilo || "Pop", confirmado: false })
}

// Guarda o estilo que o cliente aprovou (com ou sem edição dele).
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const { estilo } = await req.json().catch(() => ({}))
  if (typeof estilo !== "string") return NextResponse.json({ error: "Estilo inválido." }, { status: 400 })

  const supabase = createServerClient()
  const { data: order } = await supabase
    .from("orders").select("id, paymentStatus, lyricsApproved").eq("id", id).maybeSingle()
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  if (order.paymentStatus !== "PAID") return NextResponse.json({ error: "Pedido não está pago." }, { status: 403 })
  // Depois de aprovada a letra a música já foi disparada — mudar o estilo
  // aqui não teria efeito nenhum e daria a impressão falsa de que teve.
  if (order.lyricsApproved) return NextResponse.json({ error: "A letra já foi aprovada." }, { status: 409 })

  // Teto de 200 pra bater com o limite que buildSunoStyle já aplica; o campo
  // do Suno é curto e texto longo demais é ignorado no meio.
  const limpo = estilo.replace(/\s+/g, " ").trim().slice(0, 200)
  const { error } = await supabase.from("orders").update({ style_confirmed: limpo || null }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, estilo: limpo })
}
