import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { z } from "zod"

const schema = z.object({
  status: z.enum(["PENDING", "IN_PRODUCTION", "DELIVERED", "ABANDONED"]),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const parsed = schema.safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 })
    }

    const supabase = createServerClient()
    const { error } = await supabase
      .from("orders")
      .update({ status: parsed.data.status })
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
