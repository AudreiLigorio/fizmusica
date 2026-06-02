import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET() {
  try {
    const supabase = createServerClient()

    const { data: occasions, error } = await supabase
      .from("wizard_occasions")
      .select(`
        id, label, emoji, slug,
        wizard_subcategories (
          id, label, emoji, slug, sort_order,
          wizard_questions (
            id, label, sort_order
          )
        )
      `)
      .eq("active", true)
      .order("sort_order", { ascending: true })

    if (error) throw error

    // Ordena subcategorias e perguntas
    const sorted = occasions.map((o) => ({
      ...o,
      wizard_subcategories: o.wizard_subcategories
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({
          ...s,
          wizard_questions: s.wizard_questions.sort(
            (a, b) => a.sort_order - b.sort_order
          ),
        })),
    }))

    return NextResponse.json({ occasions: sorted })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
