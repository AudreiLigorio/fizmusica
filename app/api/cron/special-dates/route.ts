import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { sendSpecialDateReminderEmail } from "@/app/services/emailService"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// DOIS avisos por data, por ano (antes era um só, 15 dias antes):
// - 10 dias: tempo de encomendar e a música ficar pronta.
// - 2 dias:  resgate de quem deixou pra depois.
//
// "Já avisei" é por ANO da ocorrência, não booleano — a data se repete todo
// ano, então um "já avisei" simples faria o aniversário ser lembrado uma vez
// na vida. Cada aviso tem sua própria coluna (migração 056): com uma só, o
// de 10 dias marcaria o ano e o de 2 dias nunca sairia.
//
// A JANELA é `<=`, não igualdade. Antes era `days !== 15 → pula`: se o cron
// falhasse justo naquele dia, o aviso daquele ano se perdia sem recuperação.
// Agora ele ainda sai no dia seguinte, e o e-mail diz os dias REAIS que
// faltam, não o número da faixa.
const AVISOS = [
  { dias: 10, coluna: "last_reminder_sent_for_year" as const, min: 3 },
  { dias: 2,  coluna: "last_reminder_2d_for_year"   as const, min: 0 },
]

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
    .select("id, nome, email, conta_nome, ocasiao_emoji, ocasiao_label, data, last_reminder_sent_for_year, last_reminder_2d_for_year")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = new Date()
  let sent = 0, skipped = 0, failed = 0

  for (const row of rows ?? []) {
    if (!row.email) { skipped++; continue } // linha antiga, de antes da fase 2
    const { days, year } = nextOccurrence(row.data, today)

    // O primeiro aviso cuja janela a data alcançou e que ainda não saiu este
    // ano. `min` impede que o de 10 dias roube a vez do de 2: quem cadastra
    // uma data faltando 2 dias recebe só o aviso de 2, não os dois seguidos.
    const aviso = AVISOS.find(
      (a) => days <= a.dias && days >= a.min && row[a.coluna] !== year,
    )
    if (!aviso) { skipped++; continue }

    const result = await sendSpecialDateReminderEmail({
      email: row.email,
      contaNome: row.conta_nome,
      nome: row.nome,
      ocasiaoEmoji: row.ocasiao_emoji,
      ocasiaoLabel: row.ocasiao_label,
      // Dias REAIS, não o número da faixa: se o cron falhar um dia, o e-mail
      // não pode dizer "faltam 10" quando faltam 9.
      diasFaltando: days,
    })

    if (result.ok) {
      await supabase.from("special_dates").update({ [aviso.coluna]: year }).eq("id", row.id)
      sent++
    } else {
      failed++
    }
  }

  return NextResponse.json({ total: rows?.length ?? 0, sent, skipped, failed })
}
