import type { SupabaseClient } from "@supabase/supabase-js"

export type Coupon = {
  id: string
  code: string
  type: "PERCENT" | "FIXED"
  value: number
  min_value: number | null
  max_uses: number | null
  used_count: number
  active: boolean
  expires_at: string | null
  show_on_site: boolean
  description: string | null
}

// Nº de usos de um cupom = quantidade de pedidos PAGOS que o carregam.
// Fonte da verdade (em vez do contador `used_count`, que subcontava PIX e podia
// duplicar). `orders.coupon_code` é gravado na criação da cobrança, então cobre
// cartão e PIX igualmente.
export async function countCouponUses(supabase: SupabaseClient, code: string): Promise<number> {
  const clean = String(code ?? "").trim()
  if (!clean) return 0
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .ilike("coupon_code", clean)
    .eq("paymentStatus", "PAID")
  return count ?? 0
}

// Melhor cupom público ativo (para banner no site + e-mails de marketing).
export async function getActivePublicCoupon(supabase: SupabaseClient): Promise<Coupon | null> {
  const { data } = await supabase
    .from("coupons")
    .select("*")
    .eq("active", true)
    .eq("show_on_site", true)
    .order("value", { ascending: false })

  const now = Date.now()
  for (const c of data ?? []) {
    if (c.expires_at != null && new Date(c.expires_at).getTime() <= now) continue
    if (c.max_uses != null && (await countCouponUses(supabase, c.code)) >= c.max_uses) continue
    return c as Coupon
  }
  return null
}

export function couponLabel(c: Pick<Coupon, "type" | "value">): string {
  return c.type === "PERCENT" ? `${Number(c.value)}% OFF` : `R$ ${Number(c.value).toFixed(2)} OFF`
}

export type ExistsResult =
  | { valid: true; coupon: Coupon }
  | { valid: false; reason: string }

// Checa só existência/ativo/validade/uso do cupom — sem depender do total do
// pedido. Usado quando o cliente digita o código antes de escolher o produto.
export async function checkCouponActive(
  supabase: SupabaseClient,
  code: string
): Promise<ExistsResult> {
  const clean = String(code ?? "").trim()
  if (!clean) return { valid: false, reason: "Informe um código." }

  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .ilike("code", clean)
    .maybeSingle()

  if (!coupon) return { valid: false, reason: "Cupom não encontrado." }
  if (!coupon.active) return { valid: false, reason: "Cupom inativo." }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now())
    return { valid: false, reason: "Cupom expirado." }
  if (coupon.max_uses != null && (await countCouponUses(supabase, coupon.code)) >= coupon.max_uses)
    return { valid: false, reason: "Cupom esgotado." }

  return { valid: true, coupon: coupon as Coupon }
}

export type ValidationResult =
  | { valid: true; coupon: Coupon; discount: number; finalTotal: number }
  | { valid: false; reason: string }

// Valida um cupom contra o total do pedido e devolve o desconto calculado.
// Usado tanto pelo endpoint público (preview) quanto pelo create (autoridade).
export async function validateCoupon(
  supabase: SupabaseClient,
  code: string,
  orderTotal: number
): Promise<ValidationResult> {
  const check = await checkCouponActive(supabase, code)
  if (!check.valid) return check
  const coupon = check.coupon

  if (coupon.min_value != null && orderTotal < Number(coupon.min_value))
    return { valid: false, reason: `Pedido mínimo de R$ ${Number(coupon.min_value).toFixed(2)} para usar este cupom.` }

  let discount = coupon.type === "PERCENT"
    ? (orderTotal * Number(coupon.value)) / 100
    : Number(coupon.value)

  discount = Math.min(discount, orderTotal)         // nunca maior que o total
  discount = Math.round(discount * 100) / 100        // 2 casas

  return {
    valid: true,
    coupon: coupon as Coupon,
    discount,
    finalTotal: Math.round((orderTotal - discount) * 100) / 100,
  }
}
