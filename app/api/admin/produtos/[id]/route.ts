import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { z } from "zod"

// O proxy só cobre /admin/* — rota de API precisa conferir o cookie por conta
// própria, senão qualquer um edita preço ou exclui plano do catálogo.
async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyAdminToken(token) : false
}

const schema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().optional(),
  price:       z.number().positive().optional(),
  active:      z.boolean().optional(),
  featured:    z.boolean().optional(),
  category:    z.enum(["DIGITAL", "DIGITAL_PHYSICAL"]).optional(),
  weight_g:    z.number().int().positive().optional().nullable(),
  height_cm:   z.number().int().positive().optional().nullable(),
  width_cm:    z.number().int().positive().optional().nullable(),
  length_cm:   z.number().int().positive().optional().nullable(),
  photo_limit: z.number().int().min(0).optional(),
  // Recursos do plano (migration 042). O identificador NÃO entra aqui: mudar
  // depois quebraria o vínculo de todo pedido já vendido naquele plano.
  feat_lyrics_sync: z.boolean().optional(),
  feat_qrcode:      z.boolean().optional(),
  feat_download:    z.boolean().optional(),
  feat_revision:    z.boolean().optional(),
})

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }
  const { id } = await params
  const supabase = createServerClient()

  // Verifica se há pedidos vinculados
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("productId", id)

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Não é possível excluir: este produto possui ${count} pedido(s) vinculado(s). Desative-o em vez de excluir.` },
      { status: 409 }
    )
  }

  // Busca IDs das opções de entrega deste produto
  const { data: opts } = await supabase
    .from("product_delivery_options")
    .select("id")
    .eq("product_id", id)

  const optIds = (opts ?? []).map((o) => o.id)

  // Limpa referência em orders.deliveryOptionId
  if (optIds.length > 0) {
    const { error: clrOrders } = await supabase
      .from("orders")
      .update({ deliveryOptionId: null })
      .in("deliveryOptionId", optIds)

    if (clrOrders) {
      return NextResponse.json({ error: clrOrders.message ?? "Erro ao limpar referências de entrega." }, { status: 500 })
    }
  }

  // Remove opções de entrega vinculadas antes de excluir o produto
  const { error: delOpts } = await supabase
    .from("product_delivery_options")
    .delete()
    .eq("product_id", id)

  if (delOpts) {
    return NextResponse.json({ error: delOpts.message ?? "Erro ao excluir opções de entrega." }, { status: 500 })
  }

  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) {
    return NextResponse.json({ error: error.message ?? "Erro ao excluir produto." }, { status: 500 })
  }

  revalidatePath("/admin/produtos")
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }
  try {
    const { id } = await params
    const parsed = schema.safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const supabase = createServerClient()
    // updatedAt não tem default nem trigger no banco — quem carimba é a
    // aplicação. Sem isto a coluna congela na data de criação do produto.
    const { error } = await supabase
      .from("products")
      .update({ ...parsed.data, updatedAt: new Date().toISOString() })
      .eq("id", id)

    // O erro do Supabase é um objeto simples, não um Error: no catch genérico
    // ele viraria "Erro desconhecido" e esconderia a causa real.
    if (error) {
      return NextResponse.json({ error: error.message ?? "Erro ao salvar." }, { status: 500 })
    }

    revalidatePath("/admin/produtos")
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
