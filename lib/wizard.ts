import { createServerClient } from "@/lib/supabase"

export type WizardQuestion    = { id: string; label: string; sort_order: number }
export type WizardSubcategory = { id: string; label: string; emoji: string; slug: string; sort_order: number; wizard_questions: WizardQuestion[] }
export type WizardOccasion    = { id: string; label: string; emoji: string; slug: string; wizard_subcategories: WizardSubcategory[] }

// Busca as ocasiões ativas (com subcategorias e perguntas) já ordenadas.
// Compartilhada entre a API (/api/wizard) e a renderização SSR da tela /criar.
export async function getWizardOccasions(): Promise<WizardOccasion[]> {
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

  if (error || !occasions) throw error ?? new Error("Sem dados de ocasiões")

  // Ordena subcategorias e perguntas
  return occasions.map((o: any) => ({
    ...o,
    wizard_subcategories: (o.wizard_subcategories ?? [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((s: any) => ({
        ...s,
        wizard_questions: (s.wizard_questions ?? []).sort(
          (a: any, b: any) => a.sort_order - b.sort_order
        ),
      })),
  }))
}
