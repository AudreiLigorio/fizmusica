import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { validateImageUpload } from "@/lib/imageValidation"

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

// Foto do perfil. Mesma validação por magic bytes das fotos do pedido: o tipo
// real vem dos primeiros bytes do arquivo, nunca da extensão ou do
// Content-Type que o navegador declarou (SVG é barrado — pode embutir script).
export async function POST(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  const valid = await validateImageUpload(file instanceof File ? file : null)
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 })

  const supabase = createServerClient()

  // Caminho novo a cada troca (timestamp): sem isso o cache do navegador
  // seguraria a foto antiga mesmo depois de trocada.
  const path = `${user.id}/${Date.now()}.${valid.type.ext}`
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, valid.bytes, { contentType: valid.type.mime, upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Remove a anterior — o perfil guarda uma foto só, não um histórico.
  const { data: antes } = await supabase.from("profiles").select("avatar_path").eq("user_id", user.id).maybeSingle()
  if (antes?.avatar_path && antes.avatar_path !== path) {
    await supabase.storage.from("avatars").remove([antes.avatar_path]).catch(() => {})
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, avatar_path: path, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60)
  return NextResponse.json({ ok: true, avatarUrl: signed?.signedUrl ?? null })
}
