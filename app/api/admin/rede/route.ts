import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { logOrderEvent } from "@/lib/orderEvents"

export const dynamic = "force-dynamic"

// Decisão do admin sobre uma música denunciada (Catálogo → /admin/musicas).
// Protegida pelo proxy.ts como toda /api/admin/*.
//
//   acao "ocultar"  → tira da Rede (orders.rede_oculta = true)
//   acao "mostrar"  → volta à Rede
//   acao "manter"   → só descarta as denúncias, a música segue no ar
//
// Toda ação encerra as denúncias abertas: já houve decisão sobre elas, e uma
// denúncia NOVA depois disso volta a aparecer como aberta. Nunca mexe em
// `publication_consent` — essa é a escolha do cliente, não do admin.
export async function POST(req: NextRequest) {
  const { orderId, acao } = await req.json().catch(() => ({}))
  if (typeof orderId !== "string" || !["ocultar", "mostrar", "manter"].includes(acao)) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }

  const supabase = createServerClient()

  if (acao !== "manter") {
    const oculta = acao === "ocultar"
    const { error } = await supabase.from("orders").update({ rede_oculta: oculta }).eq("id", orderId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logOrderEvent(supabase, orderId, oculta ? "rede_ocultada" : "rede_restaurada", undefined, "admin")
  }

  await supabase.from("music_reports").update({ status: "resolvida" }).eq("orderId", orderId).eq("status", "aberta")

  return NextResponse.json({ ok: true })
}
