import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET() {
  try {
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from("products")
      .select(`
        id, name, description, price, imageUrl, featured, category, photo_limit,
        feat_lyrics_sync, feat_qrcode, feat_download, feat_revision,
        product_delivery_options (
          id, label, days, price_extra, sort_order, active
        ),
        product_images (
          id, url, is_cover, sort_order
        )
      `)
      .eq("active", true)
      .order("featured", { ascending: false })
      .order("sortOrder", { ascending: true })

    if (error) throw error

    const products = (data ?? []).map((p) => ({
      ...p,
      product_delivery_options: (p.product_delivery_options ?? [])
        .filter((o: { active?: boolean }) => o.active !== false)
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
      product_images: (p.product_images ?? [])
        .sort((a: { is_cover: boolean; sort_order: number }, b: { is_cover: boolean; sort_order: number }) =>
          a.is_cover === b.is_cover ? a.sort_order - b.sort_order : a.is_cover ? -1 : 1
        ),
    }))

    return NextResponse.json({ products })
  } catch (err) {
    console.error("[GET /api/produtos]", err)
    return NextResponse.json({ products: [] }, { status: 500 })
  }
}
