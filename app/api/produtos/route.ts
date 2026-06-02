import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET() {
  try {
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from("products")
      .select(`
        id, name, description, price, imageUrl, featured,
        product_delivery_options (
          id, label, days, price_extra, sort_order
        )
      `)
      .eq("active", true)
      .order("featured", { ascending: false })
      .order("sortOrder", { ascending: true })

    if (error) throw error

    const products = (data ?? []).map((p) => ({
      ...p,
      product_delivery_options: (p.product_delivery_options ?? [])
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
    }))

    return NextResponse.json({ products })
  } catch (err) {
    console.error("[GET /api/produtos]", err)
    return NextResponse.json({ products: [] }, { status: 500 })
  }
}
