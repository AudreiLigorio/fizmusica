import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { sendSpecialDateReminderEmail } from "@/app/services/emailService"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Aviso único, ~15 dias antes da data recorrer. A data se repete todo ano —
// "já avisei" precisa ser por ANO da ocorrência, não um boolean, senão o
// aviso do ano seguinte nunca mais sairia.
const REMINDER_DAYS_BEFORE = 15

function nextOccurrence(iso: string, today: Date): { days: number; year: number } {
  const [, m, d] = iso.split("-").map(Number)
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  let year = today.getUTCFullYear()
  let occurrence = Date.UTC(year, m - 1, d)
  if (occurrence < todayUTC) {
    year += 1
    occurrence = Date.UTC(year, m - 1, d)
  }
  const days = Math.round((occurrence - todayUTC) / 86400000)
  return { days, year }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data: rows, error } = await supabase
    .from("special_dates")
    .select("id, nome, email, conta_nome, ocasiao_emoji, ocasiao_label, data, last_reminder_sent_for_year")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = new Date()
  let sent = 0, skipped = 0, failed = 0

  for (const row of rows ?? []) {
    if (!row.email) { skipped++; continue } // linha antiga, de antes da fase 2
    const { days, year } = nextOccurrence(row.data, today)
    if (days !== REMINDER_DAYS_BEFORE || row.last_reminder_sent_for_year === year) { skipped++; continue }

    const result = await sendSpecialDateReminderEmail({
      email: row.email,
      contaNome: row.conta_nome,
      nome: row.nome,
      ocasiaoEmoji: row.ocasiao_emoji,
      ocasiaoLabel: row.ocasiao_label,
      diasFaltando: REMINDER_DAYS_BEFORE,
    })

    if (result.ok) {
      await supabase.from("special_dates").update({ last_reminder_sent_for_year: year }).eq("id", row.id)
      sent++
    } else {
      failed++
    }
  }

  return NextResponse.json({ total: rows?.length ?? 0, sent, skipped, failed })
}
