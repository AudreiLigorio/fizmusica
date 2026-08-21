import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

async function getUserFromAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

// Letras/números sem ambiguidade visual (sem 0/O, 1/I/L) — o código é lido
// pelo amigo de um print/mensagem do WhatsApp, não digitado com autocomplete.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
function gerarCodigo(): string {
  let code = ""
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return code
}

// Get-or-create: o código só nasce quando o cliente abre a tela pela
// primeira vez — não precisa existir pra conta que nunca indicou ninguém.
export async function GET(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ code: existing.code })

  // Colisão é improvável (32^6) mas o unique index protege — tenta algumas vezes.
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const code = gerarCodigo()
    const { data: row, error } = await supabase
      .from("referral_codes")
      .insert({ user_id: user.id, code })
      .select("code")
      .single()
    if (!error) return NextResponse.json({ code: row.code })
    if (!String(error.message).includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ error: "Não consegui gerar um código único. Tente de novo." }, { status: 500 })
}
