import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createServerClient } from "@/lib/supabase"
import { z } from "zod"

const schema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().optional(),
  price:       z.number().positive().optional(),
  active:      z.boolean().optional(),
  featured:    z.boolean().optional(),
})

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const parsed = schema.safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const supabase = createServerClient()
    const { error } = await supabase
      .from("products")
      .update(parsed.data)
      .eq("id", id)

    if (error) throw error

    revalidatePath("/admin/produtos")
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
