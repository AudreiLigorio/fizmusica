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

export default async function CrmPage() {
  const unpaidOrders = await getUnpaidOrders()
  return <CrmClient unpaidOrders={unpaidOrders} />
}
