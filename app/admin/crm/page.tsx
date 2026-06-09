import { createServerClient } from "@/lib/supabase"
import CrmClient from "./CrmClient"

export const dynamic = "force-dynamic"

async function getUnpaidOrders() {
  const supabase = createServerClient()
  const oneHourAgo  = new Date(Date.now() - 1  * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Pendentes (ainda não enviamos e-mail — cron ainda não rodou)
  const { data: pending } = await supabase
    .from("orders")
    .select("id, nome, email, whatsapp, subcategory, musicalStyle, createdAt, status")
    .eq("paymentStatus", "UNPAID")
    .neq("status", "ABANDONED")
    .lt("createdAt", oneHourAgo)
    .gt("createdAt", sevenDaysAgo)
    .order("createdAt", { ascending: false })

  // Abandonados recentes (já receberam e-mail automático)
  const { data: abandoned } = await supabase
    .from("orders")
    .select("id, nome, email, whatsapp, subcategory, musicalStyle, createdAt, status")
    .eq("paymentStatus", "UNPAID")
    .eq("status", "ABANDONED")
    .gt("createdAt", sevenDaysAgo)
    .order("createdAt", { ascending: false })
    .limit(20)

  return {
    pending:   (pending   ?? []).map(o => ({ ...o, recoveryCount: 0 })),
    abandoned: (abandoned ?? []).map(o => ({ ...o, recoveryCount: 1 })),
  }
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
  const [{ pending, abandoned }, insights] = await Promise.all([getUnpaidOrders(), getInsights()])
  return <CrmClient unpaidOrders={pending} abandonedOrders={abandoned} insights={insights as any} />
}
