import { createServerClient } from "@/lib/supabase"
import CrmClient from "./CrmClient"

export const dynamic = "force-dynamic"

async function getUnpaidOrders() {
  const supabase = createServerClient()
  const oneHourAgo   = new Date(Date.now() - 1  * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: pending } = await supabase
    .from("orders")
    .select("id, nome, email, whatsapp, subcategory, musicalStyle, createdAt, status")
    .eq("paymentStatus", "UNPAID")
    .neq("status", "ABANDONED")
    .lt("createdAt", oneHourAgo)
    .gt("createdAt", sevenDaysAgo)
    .order("createdAt", { ascending: false })

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

  const { data: orders } = await supabase
    .from("orders")
    .select("subcategory, musicalStyle, voiceType, emotion, paymentStatus")
    .neq("status", "ABANDONED")

  // Cliques no wizard (inclui quem abandonou antes de virar pedido) — últimos 90 dias
  // pra não misturar com sessões antigas/lixo de teste.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: sessions } = await supabase
    .from("wizard_sessions")
    .select("data")
    .gte("created_at", since)

  const clickMaps = {
    occasions: new Map<string, number>(),
    styles:    new Map<string, number>(),
    voices:    new Map<string, number>(),
    emotions:  new Map<string, number>(),
  }
  const bump = (map: Map<string, number>, key: unknown) => {
    if (!key || typeof key !== "string") return
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  for (const s of sessions ?? []) {
    const d = s.data as Record<string, unknown> | null
    if (!d) continue
    bump(clickMaps.occasions, d.selectedSubcategory)
    bump(clickMaps.styles,    d.musicalStyle)
    bump(clickMaps.voices,    d.voiceType)
    bump(clickMaps.emotions,  d.emotion)
  }

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

  const toRows = (map: typeof occasionMap, clicks: Map<string, number>) =>
    Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, clicks: clicks.get(name) ?? v.total, rate: v.total > 0 ? Math.round((v.paid / v.total) * 100) : 0 }))
      .sort((a, b) => b.clicks - a.clicks)

  return {
    occasions: toRows(occasionMap, clickMaps.occasions),
    styles:    toRows(styleMap,    clickMaps.styles),
    voices:    toRows(voiceMap,    clickMaps.voices),
    emotions:  toRows(emotionMap,  clickMaps.emotions),
  }
}

async function getFeedbacks() {
  const supabase = createServerClient()

  const { data } = await supabase
    .from("feedbacks")
    .select("id, orderId, rating, highlight, improvement, submittedAt, createdAt, orders(nome, subcategory, musicalStyle)")
    .not("submittedAt", "is", null)
    .order("submittedAt", { ascending: false })
    .limit(100)

  return (data ?? []).map(f => ({
    id:          f.id as string,
    orderId:     f.orderId as string,
    rating:      f.rating as number,
    highlight:   f.highlight as string,
    improvement: f.improvement as string | null,
    submittedAt: f.submittedAt as string,
    nome:        (f.orders as any)?.nome         ?? "—",
    subcategory: (f.orders as any)?.subcategory  ?? "—",
    musicalStyle:(f.orders as any)?.musicalStyle ?? "—",
  }))
}

export default async function CrmPage() {
  const [{ pending, abandoned }, insights, feedbacks] = await Promise.all([
    getUnpaidOrders(),
    getInsights(),
    getFeedbacks(),
  ])
  return (
    <CrmClient
      unpaidOrders={pending}
      abandonedOrders={abandoned}
      insights={insights as any}
      feedbacks={feedbacks}
    />
  )
}
