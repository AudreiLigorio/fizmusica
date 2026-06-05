import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createServerClient } from "@/lib/supabase"
import { z } from "zod"

const schema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().optional(),
  price:       z.number().positive().optional(),
  active:      z.boolean().optional(),
  featured:    z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const parsed = schema.safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const supabase = createServerClient()
    const { error } = await supabase
      .from("products")
      .update(parsed.data)
      .eq("id", id)

    if (error) throw error

    revalidatePath("/admin/produtos")
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
