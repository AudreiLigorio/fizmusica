import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getActivePublicCoupon, couponLabel } from "@/lib/coupons"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = createServerClient()
  const coupon = await getActivePublicCoupon(supabase)
  if (!coupon) return NextResponse.json({ coupon: null })
  return NextResponse.json({
    coupon: {
      code: coupon.code,
      label: couponLabel(coupon),
      description: coupon.description,
      min_value: coupon.min_value,
    },
  })
}
