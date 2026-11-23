import CriarClient, { type PlanoResumo } from "./CriarClient"
import { getWizardOccasions, type WizardOccasion } from "@/lib/wizard"
import { createServerClient } from "@/lib/supabase"

// As ocasiões mudam raramente (só via admin). Renderiza no servidor e cacheia
// por 5 min para que os cards apareçam instantaneamente, sem fetch no cliente.
export const revalidate = 300

export default async function CriarPage() {
  let initialOccasions: WizardOccasion[] = []
  try {
    initialOccasions = await getWizardOccasions()
  } catch {
    // Fallback resiliente: se o servidor não carregar (ex.: DB indisponível no
    // build), o cliente busca via /api/wizard e mostra o skeleton enquanto isso.
    initialOccasions = []
  }

  // Nome e preço dos planos ativos já vêm na página: quem chega por
  // `?produto=` (anúncio, vitrine da home) vê o aviso "Plano escolhido" no
  // primeiro desenho. Antes vinha de um fetch no cliente e o aviso surgia
  // 1-2s depois, empurrando a tela pra baixo bem quando a pessoa ia tocar.
  let planos: PlanoResumo[] = []
  try {
    const { data } = await createServerClient()
      .from("products")
      .select("id, name, price")
      .eq("active", true)
    planos = (data ?? []).map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))
  } catch {
    planos = []
  }

  return <CriarClient initialOccasions={initialOccasions} planos={planos} />
}
