import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { z } from "zod"

const schema = z.object({
  label:       z.string().min(1).optional(),
  placeholder: z.string().optional(),
  type:        z.enum(["text", "textarea", "select"]).optional(),
  required:    z.boolean().optional(),
  sort_order:  z.number().int().nonnegative().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const supabase = createServerClient()
    const { error } = await supabase.from("wizard_questions").update(parsed.data).eq("id", id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const { error } = await supabase.from("wizard_questions").delete().eq("id", id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 })
  }
}
