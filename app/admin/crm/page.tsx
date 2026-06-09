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
    .select("subcategory, musicalStyle, voiceType, emotion, paymentStatus")
    .neq("status", "ABANDONED")

  if (!orders?.length) return { occasions: [], styles: [], voices: [], emotions: [] }

  const occasionMap = new Map<string, { total: number; paid: number }>()
  const styleMap    = new Map<string, { total: number; paid: number }>()
  const voiceMap    = new Map<string, { total: number; paid: number }>()
  const emotionMap  = new Map<string, { total: number; paid: number }>()

  for (const o of orders) {
    const paid = o.paymentStatus === "PAID"
    const add  = (map: typeof occasionMap, key: string | null) => {
      if (!key) return
      const cur = map.get(key) ?? { total: 0, paid: 0 }
      cur.total++
      if (paid) cur.paid++
      map.set(key, cur)
    }
    add(occasionMap, o.subcategory)
    add(styleMap,    o.musicalStyle)
    add(voiceMap,    o.voiceType)
    add(emotionMap,  o.emotion)
  }

  const toRows = (map: typeof occasionMap) =>
    Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, rate: v.total > 0 ? Math.round((v.paid / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)

  return {
    occasions: toRows(occasionMap),
    styles:    toRows(styleMap),
    voices:    toRows(voiceMap),
    emotions:  toRows(emotionMap),
  }
}

export default async function CrmPage() {
  const [unpaidOrders, insights] = await Promise.all([getUnpaidOrders(), getInsights()])
  return <CrmClient unpaidOrders={unpaidOrders} insights={insights as any} />
}
