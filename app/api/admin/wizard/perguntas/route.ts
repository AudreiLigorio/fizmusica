import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { z } from "zod"

const schema = z.object({
  subcategory_id: z.string().uuid(),
  label:          z.string().min(1),
  placeholder:    z.string().optional(),
  type:           z.enum(["text", "textarea", "select"]).default("text"),
  required:       z.boolean().default(true),
  sort_order:     z.number().int().nonnegative().optional(),
})

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const supabase = createServerClient()
    const { data, error } = await supabase.from("wizard_questions").insert(parsed.data).select().single()
    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 })
  }
}
