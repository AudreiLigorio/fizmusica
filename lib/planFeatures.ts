import type { createServerClient } from "@/lib/supabase"
import { DEFAULT_PHOTO_LIMIT } from "@/lib/photoLimit"

type DB = ReturnType<typeof createServerClient>

// Recursos que o plano (produto) contratado libera. Uma definição só, lida
// pela área do cliente, pelo player e pelas rotas que precisam recusar quem
// não contratou — esconder o botão nunca basta, a URL continua acessível.
export type PlanFeatures = {
  /** Quantas fotos o cliente pode enviar. 0 = plano sem fotos. */
  fotos: number
  letraSincronizada: boolean
  qrcode: boolean
  download: boolean
  revisao: boolean
}

/** Colunas a incluir no embed `products(...)` de uma query de pedido. */
export const PLAN_FEATURE_COLUMNS =
  "photo_limit, feat_lyrics_sync, feat_qrcode, feat_download, feat_revision"

// Pedido sem produto (rascunho não pago) ou produto sumido: libera tudo.
//
// A escolha é deliberada e vale a pena registrar: entre errar liberando e
// errar bloqueando, bloquear é pior. Um pedido pago que perde o QR Code por
// causa de um dado inconsistente vira reclamação legítima de quem pagou;
// liberar a mais, no limite, entrega cortesia. Mesma razão do DEFAULT TRUE
// da migration 042.
const TUDO_LIBERADO: PlanFeatures = {
  fotos: DEFAULT_PHOTO_LIMIT,
  letraSincronizada: true,
  qrcode: true,
  download: true,
  revisao: true,
}

type ProductRow = {
  photo_limit?: number | null
  feat_lyrics_sync?: boolean | null
  feat_qrcode?: boolean | null
  feat_download?: boolean | null
  feat_revision?: boolean | null
} | null | undefined

/**
 * Normaliza a linha do produto em recursos.
 *
 * Cada `?? true` é o mesmo raciocínio do fallback acima: coluna nula (produto
 * criado antes da migration, ou embed que não trouxe o campo) não pode virar
 * recurso cancelado.
 */
export function featuresFromProduct(product: ProductRow): PlanFeatures {
  if (!product) return TUDO_LIBERADO
  return {
    fotos:             product.photo_limit ?? DEFAULT_PHOTO_LIMIT,
    letraSincronizada: product.feat_lyrics_sync ?? true,
    qrcode:            product.feat_qrcode ?? true,
    download:          product.feat_download ?? true,
    revisao:           product.feat_revision ?? true,
  }
}

/** Lê os recursos do plano de um pedido. Usado pelas travas de servidor. */
export async function getPlanFeatures(supabase: DB, orderId: string): Promise<PlanFeatures> {
  const { data: order } = await supabase
    .from("orders").select("productId").eq("id", orderId).maybeSingle()
  if (!order?.productId) return TUDO_LIBERADO

  const { data: product } = await supabase
    .from("products").select(PLAN_FEATURE_COLUMNS).eq("id", order.productId).maybeSingle()
  return featuresFromProduct(product as ProductRow)
}
