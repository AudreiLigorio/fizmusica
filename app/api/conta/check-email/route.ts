import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}))
  const cleanEmail = String(email ?? "").trim().toLowerCase()
  if (!cleanEmail.includes("@")) {
    return NextResponse.json({ hasOrders: false })
  }

  const supabase = createServerClient()
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .ilike("email", cleanEmail)

  return NextResponse.json({ hasOrders: (count ?? 0) > 0 })
}
