import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { acceptRevision } from "@/lib/revision"

export const dynamic = "force-dynamic"

type Params = Promise<{ id: string }>

// Aceita a revisão de um pedido (clique manual do admin na fila de Produção).
export async function POST(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const supabase = createServerClient()
  const result = await acceptRevision(supabase, id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, newOrderId: result.newOrderId })
}
