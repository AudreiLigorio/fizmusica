import CriarClient from "./CriarClient"
import { getWizardOccasions, type WizardOccasion } from "@/lib/wizard"

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

  return <CriarClient initialOccasions={initialOccasions} />
}
