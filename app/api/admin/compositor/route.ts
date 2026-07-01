import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getComposerSettings } from "@/lib/composer/settings"

export async function GET() {
  const settings = await getComposerSettings()
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const prompt   = (body.prompt   ?? "").trim()
  const model    = (body.model    ?? "").trim() || "gemini-flash-latest"
  const location = (body.location ?? "").trim() || "global"

  if (!prompt) return NextResponse.json({ error: "Prompt obrigatório" }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase
    .from("composer_settings")
    .upsert({ id: 1, prompt, model, location, updatedAt: new Date().toISOString() }, { onConflict: "id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
