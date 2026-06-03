import { createServerClient } from "@/lib/supabase"
import Link from "next/link"
import { notFound } from "next/navigation"
import SubcategoryActions from "./SubcategoryActions"

async function getData(occasionId: string) {
  const supabase = createServerClient()
  const [occRes, subRes] = await Promise.all([
    supabase.from("wizard_occasions").select("id, label, emoji").eq("id", occasionId).single(),
    supabase.from("wizard_subcategories")
      .select("id, label, emoji, slug, active, sort_order, wizard_questions(count)")
      .eq("occasion_id", occasionId)
      .order("sort_order", { ascending: true }),
  ])
  return { occasion: occRes.data, subcategories: subRes.data ?? [] }
}

export default async function AdminWizardOcasiao({ params }: { params: Promise<{ occasionId: string }> }) {
  const { occasionId } = await params
  const { occasion, subcategories } = await getData(occasionId)

  if (!occasion) notFound()

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/wizard" className="text-gray-500 hover:text-white text-sm">← Wizard</Link>
        <h1 className="text-2xl font-bold">{occasion.emoji} {occasion.label}</h1>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-500">{subcategories.length} subcategoria{subcategories.length !== 1 ? "s" : ""}</p>
        <SubcategoryActions mode="create" occasionId={occasionId} />
      </div>

      <div className="space-y-3">
        {subcategories.map((s) => {
          const count = (s.wizard_questions as unknown as { count: number }[])[0]?.count ?? 0
          return (
            <div key={s.id} className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-4">
              <span className="text-xl w-7">{s.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{s.label}</span>
                  {!s.active && <span className="text-xs bg-gray-500/15 text-gray-400 px-2 py-0.5 rounded-full">Inativo</span>}
                </div>
                <span className="text-xs text-gray-500">{count} pergunta{count !== 1 ? "s" : ""} · slug: {s.slug}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/wizard/${occasionId}/${s.id}`}
                  className="text-sm text-pink-400 hover:text-pink-300 border border-pink-500/20 hover:border-pink-500/40 px-4 py-2 rounded-xl transition-all"
                >
                  Perguntas →
                </Link>
                <SubcategoryActions mode="edit" occasionId={occasionId} subcategory={s} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
