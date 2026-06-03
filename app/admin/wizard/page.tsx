import { createServerClient } from "@/lib/supabase"
import Link from "next/link"
import OccasionActions from "./OccasionActions"

async function getOccasions() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("wizard_occasions")
    .select("id, label, emoji, slug, active, sort_order, wizard_subcategories(count)")
    .order("sort_order", { ascending: true })
  return data ?? []
}

export default async function AdminWizard() {
  const occasions = await getOccasions()

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl lg:text-3xl font-bold">Wizard Manager</h1>
        <OccasionActions mode="create" />
      </div>
      <p className="text-gray-500 text-sm mb-6 lg:mb-8">Gerencie ocasiões, subcategorias e perguntas do formulário</p>

      <div className="space-y-3">
        {occasions.map((o) => {
          const count = (o.wizard_subcategories as unknown as { count: number }[])[0]?.count ?? 0
          return (
            <div
              key={o.id}
              className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-4"
            >
              <span className="text-2xl w-8">{o.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{o.label}</span>
                  {!o.active && (
                    <span className="text-xs bg-gray-500/15 text-gray-400 px-2 py-0.5 rounded-full">Inativo</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{count} subcategoria{count !== 1 ? "s" : ""} · slug: {o.slug}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/wizard/${o.id}`}
                  className="text-sm text-pink-400 hover:text-pink-300 border border-pink-500/20 hover:border-pink-500/40 px-4 py-2 rounded-xl transition-all"
                >
                  Subcategorias →
                </Link>
                <OccasionActions mode="edit" occasion={o} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
