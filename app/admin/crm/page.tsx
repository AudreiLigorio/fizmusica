import { createServerClient } from "@/lib/supabase"
import CrmClient from "./CrmClient"

export const dynamic = "force-dynamic"

async function getUnpaidOrders() {
  const supabase = createServerClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from("orders")
    .select("id, nome, email, whatsapp, subcategory, musicalStyle, createdAt")
    .eq("paymentStatus", "UNPAID")
    .neq("status", "ABANDONED")
    .lt("createdAt", oneHourAgo)
    .order("createdAt", { ascending: false })
  return (data ?? []).map(o => ({ ...o, recoveryCount: 0 }))
}

async function getInsights() {
  const supabase = createServerClient()

  // Busca todos os pedidos com paymentStatus
  const { data: orders } = await supabase
    .from("orders")
    .select("subcategory, musicalStyle, paymentStatus")
    .neq("status", "ABANDONED")

  if (!orders?.length) return { occasions: [], styles: [] }

  // Agrupa por subcategory
  const occasionMap = new Map<string, { total: number; paid: number }>()
  const styleMap    = new Map<string, { total: number; paid: number }>()

  for (const o of orders) {
    // Ocasião
    if (o.subcategory) {
      const cur = occasionMap.get(o.subcategory) ?? { total: 0, paid: 0 }
      cur.total++
      if (o.paymentStatus === "PAID") cur.paid++
      occasionMap.set(o.subcategory, cur)
    }
    // Estilo
    if (o.musicalStyle) {
      const cur = styleMap.get(o.musicalStyle) ?? { total: 0, paid: 0 }
      cur.total++
      if (o.paymentStatus === "PAID") cur.paid++
      styleMap.set(o.musicalStyle, cur)
    }
  }

  const occasions = Array.from(occasionMap.entries())
    .map(([name, v]) => ({ name, ...v, rate: v.total > 0 ? Math.round((v.paid / v.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)

  const styles = Array.from(styleMap.entries())
    .map(([name, v]) => ({ name, ...v, rate: v.total > 0 ? Math.round((v.paid / v.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)

  return { occasions, styles }
}

export default async function CrmPage() {
  const [unpaidOrders, insights] = await Promise.all([getUnpaidOrders(), getInsights()])
  return <CrmClient unpaidOrders={unpaidOrders} insights={insights} />
}
