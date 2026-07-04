import type { createServerClient } from "@/lib/supabase"

type DB = ReturnType<typeof createServerClient>

// Limite padrão usado ANTES do cliente escolher o produto (no wizard, o passo Fotos
// vem antes do passo Produto) e como fallback para pedidos sem productId.
export const DEFAULT_PHOTO_LIMIT = 10

// Resolve o limite de fotos de um pedido a partir do produto escolhido (products.photo_limit).
// Sem produto ainda (ou produto sem o campo) → DEFAULT_PHOTO_LIMIT.
export async function getPhotoLimit(supabase: DB, orderId: string): Promise<number> {
  const { data: order } = await supabase
    .from("orders").select("productId").eq("id", orderId).maybeSingle()
  if (!order?.productId) return DEFAULT_PHOTO_LIMIT

  const { data: product } = await supabase
    .from("products").select("photo_limit").eq("id", order.productId).maybeSingle()
  return product?.photo_limit ?? DEFAULT_PHOTO_LIMIT
}

// Conta só as fotos do CLIENTE (exclui a capa gerada pela IA, que nunca consome o
// limite). Filtra pelo storage_path ("suno-cover-...") em vez de is_cover — esse
// campo também marca temporariamente a 1ª foto do próprio cliente como capa antes
// da IA gerar a definitiva (lib/suno/ingest.ts), e essa foto do cliente DEVE contar.
export async function countClientPhotos(supabase: DB, orderId: string): Promise<number> {
  const { count } = await supabase
    .from("order_photos")
    .select("id", { count: "exact", head: true })
    .eq("orderId", orderId)
    .not("storage_path", "like", "%suno-cover%")
  return count ?? 0
}
