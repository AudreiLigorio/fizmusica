import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { sendFeedbackRequestEmail } from "@/app/services/emailService"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServerClient()

  // Busca feedbacks pendentes cujo send_after já passou
  const { data: pending, error } = await supabase
    .from("feedbacks")
    .select(`id, token, "orderId", orders(nome, email, generated_music(musicName))`)
    .eq("email_sent", false)
    .lte("send_after", new Date().toISOString())
    .limit(20)

  if (error) {
    console.error("[cron/feedback-emails]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"
  const results: { id: string; ok: boolean; error?: string }[] = []

  for (const fb of pending ?? []) {
    const order = fb.orders as any
    if (!order?.email) { results.push({ id: fb.id, ok: false, error: "sem email" }); continue }

    const musicName = (order.generated_music as any)?.[0]?.musicName?.trim() || "sua música"
    const feedbackUrl = `${baseUrl}/feedback/${fb.token}`

    const r = await sendFeedbackRequestEmail({
      nome:        order.nome,
      email:       order.email,
      musicName,
      feedbackUrl,
    })

    if (r.ok) {
      await supabase.from("feedbacks").update({ email_sent: true }).eq("id", fb.id)
    }

    results.push({ id: fb.id, ok: r.ok, error: r.ok ? undefined : String(r.error) })
  }

  return NextResponse.json({ processed: results.length, results })
}
