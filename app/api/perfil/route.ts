import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const MAX_APELIDO = 24

async function getUserFromAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

// A foto vive em bucket privado (decisão: perfil é só do cliente), então a URL
// é assinada na hora e expira. Não dá pra guardar a URL no banco.
async function assinar(supabase: ReturnType<typeof createServerClient>, path: string | null) {
  if (!path) return null
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? null
}

export async function GET(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const supabase = createServerClient()
  const { data } = await supabase
    .from("profiles")
    .select("apelido, avatar_path, mostrar_apelido")
    .eq("user_id", user.id)
    .maybeSingle()

  return NextResponse.json({
    apelido: data?.apelido ?? null,
    avatarUrl: await assinar(supabase, data?.avatar_path ?? null),
    mostrarApelido: !!data?.mostrar_apelido,
    // E-mail de vínculo: é por ele que os pedidos entram na conta.
    email: user.email ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() }
  if ("apelido" in body) patch.apelido = String(body.apelido ?? "").trim().slice(0, MAX_APELIDO) || null
  // mostrar_apelido: opt-in separado do publication_consent — precisa ser
  // enviado explicitamente pelo cliente, nunca assumido junto do apelido.
  if ("mostrarApelido" in body) patch.mostrar_apelido = !!body.mostrarApelido

  const supabase = createServerClient()
  const { error } = await supabase.from("profiles").upsert(patch, { onConflict: "user_id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
