import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { sendWizardAbandonmentEmail } from "@/app/services/emailService"

export const dynamic = "force-dynamic"

// POST — envia e-mails de recuperação para leads que abandonaram o wizard
// Critérios: tem e-mail, step entre 2-4, atualizado há mais de X horas, ainda não recebeu e-mail de recuperação
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const horasMin = body.horasMin ?? 2 // só envia para abandono com mais de 2h

  const supabase = createServerClient()
  const since = new Date(Date.now() - horasMin * 60 * 60 * 1000).toISOString()

  // Busca sessões com lead capturado (tem e-mail), não finalizadas (step < 5), antigas o suficiente
  const { data: sessions, error } = await supabase
    .from("wizard_sessions")
    .select("id, step, data, updated_at")
    .lt("step", 5)
    .lt("updated_at", since)
    .not("data->>'email'", "is", null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const elegíveis = (sessions ?? []).filter((s) => {
    const email = s.data?.email
    const nome  = s.data?.nome
    return email && email.includes("@") && nome && nome.trim().length > 0
  })

  let enviados = 0
  let falhas = 0
  const erros: string[] = []

  for (const session of elegíveis) {
    const { ok, error: emailError } = await sendWizardAbandonmentEmail({
      nome:         session.data.nome,
      email:        session.data.email,
      subcategory:  session.data.selectedSubcategory ?? "música especial",
      musicalStyle: session.data.musicalStyle || undefined,
      sessionId:    session.id,
    })

    if (ok) {
      enviados++
      // Marca sessão como "e-mail de recuperação enviado" para não reenviar
      await supabase
        .from("wizard_sessions")
        .update({ data: { ...session.data, recoveryEmailSent: true } })
        .eq("id", session.id)
    } else {
      falhas++
      erros.push(`${session.data.email}: ${emailError}`)
    }

    // Pequena pausa entre envios para não estourar rate limit do Resend
    await new Promise((r) => setTimeout(r, 100))
  }

  return NextResponse.json({ total: elegíveis.length, enviados, falhas, erros })
}

// GET — lista leads elegíveis (prévia antes de disparar)
export async function GET(req: NextRequest) {
  const horas = Number(req.nextUrl.searchParams.get("horas") ?? "2")
  const supabase = createServerClient()
  const since = new Date(Date.now() - horas * 60 * 60 * 1000).toISOString()

  const { data: sessions, error } = await supabase
    .from("wizard_sessions")
    .select("id, step, data, updated_at")
    .lt("step", 5)
    .lt("updated_at", since)
    .not("data->>'email'", "is", null)
    .order("updated_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const elegíveis = (sessions ?? [])
    .filter((s) => s.data?.email?.includes("@") && s.data?.nome?.trim())
    .filter((s) => !s.data?.recoveryEmailSent)
    .map((s) => ({
      id:           s.id,
      step:         s.step,
      nome:         s.data.nome,
      email:        s.data.email,
      subcategory:  s.data.selectedSubcategory,
      musicalStyle: s.data.musicalStyle,
      updatedAt:    s.updated_at,
    }))

  return NextResponse.json({ total: elegíveis.length, leads: elegíveis })
}
