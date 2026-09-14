import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { apelidoPadrao } from "@/lib/apelido"

export const dynamic = "force-dynamic"

type Params = Promise<{ id: string }>

async function getUserFromAuth(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

// Consentimento OPCIONAL de divulgação da obra (música + letra) pela Fiz Música.
// Opt-in livre, revogável. Não cobre identidade de quem encomendou (não divulgada).
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const { id } = await params
  const { consent } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id, userId, email")
    .eq("id", id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  const owns = order.userId === user.id || order.email?.toLowerCase() === user.email?.toLowerCase()
  if (!owns) return NextResponse.json({ error: "Sem permissão." }, { status: 403 })

  const { error } = await supabase
    .from("orders")
    .update({
      publication_consent: !!consent,
      publication_consent_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Assinatura do autor, a partir de 2026-09-14: quem autoriza a publicação
  // passa a assinar a obra por padrão, com o primeiro nome da conta. Antes o
  // padrão era o anonimato, e o termo prometia isso com todas as letras.
  //
  // A regra só toca em quem NUNCA escolheu apelido. Não é retroatividade
  // disfarçada: quem já tem apelido gravado já decidiu — inclusive quem
  // decidiu deixar desligado — e essa escolha manda sobre o padrão novo.
  let assinatura: string | null = null
  if (consent) {
    const { data: perfil } = await supabase
      .from("profiles").select("apelido, mostrar_apelido").eq("user_id", user.id).maybeSingle()

    if (!perfil?.apelido) {
      const nome = apelidoPadrao(user.user_metadata?.full_name as string | undefined, user.email)
      if (nome) {
        await supabase.from("profiles").upsert(
          { user_id: user.id, apelido: nome, mostrar_apelido: true, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        )
        assinatura = nome
      }
    } else if (perfil.mostrar_apelido) {
      assinatura = perfil.apelido
    }
  }

  return NextResponse.json({ ok: true, consent: !!consent, assinatura })
}
