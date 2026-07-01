import { createServerClient } from "@/lib/supabase"
import Link from "next/link"
import { notFound } from "next/navigation"
import QuestionActions from "./QuestionActions"
import Reorder from "../../Reorder"

export const dynamic = "force-dynamic"

async function getData(occasionId: string, subcategoryId: string) {
  const supabase = createServerClient()
  const [occRes, subRes, qRes] = await Promise.all([
    supabase.from("wizard_occasions").select("id, label, emoji").eq("id", occasionId).single(),
    supabase.from("wizard_subcategories").select("id, label, emoji").eq("id", subcategoryId).single(),
    supabase.from("wizard_questions")
      .select("id, label, type, required, sort_order")
      .eq("subcategory_id", subcategoryId)
      .order("sort_order", { ascending: true }),
  ])
  return { occasion: occRes.data, subcategory: subRes.data, questions: qRes.data ?? [] }
}

export default async function AdminWizardPerguntas({
  params,
}: {
  params: Promise<{ occasionId: string; subcategoryId: string }>
}) {
  const { occasionId, subcategoryId } = await params
  const { occasion, subcategory, questions } = await getData(occasionId, subcategoryId)

  if (!occasion || !subcategory) notFound()

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/admin/wizard" className="hover:text-white">Wizard</Link>
        <span>›</span>
        <Link href={`/admin/wizard/${occasionId}`} className="hover:text-white">{occasion.emoji} {occasion.label}</Link>
        <span>›</span>
        <span className="text-white">{subcategory.emoji} {subcategory.label}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{subcategory.emoji} {subcategory.label}</h1>
        <QuestionActions mode="create" subcategoryId={subcategoryId} nextOrder={questions.length} />
      </div>

      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-4">
            <Reorder items={questions} index={i} endpointBase="/api/admin/wizard/perguntas" />
            <span className="text-gray-600 text-sm w-6 text-right">{i + 1}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{q.label}</p>
              <p className="text-xs text-gray-600">{q.type}{!q.required ? " · opcional" : ""}</p>
            </div>
            <QuestionActions mode="edit" subcategoryId={subcategoryId} question={q} nextOrder={questions.length} />
          </div>
        ))}

        {questions.length === 0 && (
          <div className="text-center py-12 text-gray-600">Nenhuma pergunta ainda.</div>
        )}
      </div>
    </div>
  )
}
