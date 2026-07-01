import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { validateCoupon, checkCouponActive } from "@/lib/coupons"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { code, total } = await req.json().catch(() => ({}))
  const orderTotal = Number(total)
  const supabase = createServerClient()

  // Sem total (cliente ainda não escolheu produto): valida só existência/ativo,
  // sem calcular desconto. O desconto é computado quando houver um total.
  if (!orderTotal || orderTotal <= 0) {
    const check = await checkCouponActive(supabase, code)
    if (!check.valid) return NextResponse.json(check, { status: 200 })
    return NextResponse.json({
      valid: true,
      pending: true,
      code: check.coupon.code,
      type: check.coupon.type,
      value: check.coupon.value,
    })
  }

  const result = await validateCoupon(supabase, code, orderTotal)

  if (!result.valid) return NextResponse.json(result, { status: 200 })

  return NextResponse.json({
    valid: true,
    code: result.coupon.code,
    type: result.coupon.type,
    value: result.coupon.value,
    discount: result.discount,
    finalTotal: result.finalTotal,
  })
}
