import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { z } from "zod"

const schema = z.object({
  occasion_id: z.string().uuid(),
  label:       z.string().min(1),
  emoji:       z.string().optional(),
  slug:        z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug: apenas letras minúsculas, números e hífens"),
  sort_order:  z.number().int().nonnegative().optional(),
})

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const supabase = createServerClient()
    const { data, error } = await supabase.from("wizard_subcategories").insert(parsed.data).select().single()
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "Já existe uma subcategoria com esse slug nesta ocasião. Use outro slug." }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 })
  }
}
