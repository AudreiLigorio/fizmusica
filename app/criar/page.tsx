import CriarClient from "./CriarClient"
import { getWizardOccasions, type WizardOccasion } from "@/lib/wizard"
import { createServerClient } from "@/lib/supabase"

// As ocasiões mudam raramente (só via admin). Renderiza no servidor e cacheia
// por 5 min para que os cards apareçam instantaneamente, sem fetch no cliente.
export const revalidate = 300

// Decide se o passo 0 (presente x só-pra-mim) faz sentido perguntar: se só um
// dos dois caminhos tem produto ativo, não há escolha real a fazer. Falha
// aberta (os dois true) se o banco não responder — mantém o comportamento
// de sempre perguntar, em vez de arriscar esconder o único caminho existente.
async function getProductPathAvailability() {
  try {
    const supabase = createServerClient()
    const { data } = await supabase.from("products").select("name").eq("active", true)
    const names = data ?? []
    return {
      livreDisponivel: names.some((p) => p.name === "Música Livre"),
      presenteDisponivel: names.some((p) => p.name !== "Música Livre"),
    }
  } catch {
    return { livreDisponivel: true, presenteDisponivel: true }
  }
}

export default async function CriarPage() {
  const [initialOccasions, { livreDisponivel, presenteDisponivel }] = await Promise.all([
    getWizardOccasions().catch(() => [] as WizardOccasion[]),
    getProductPathAvailability(),
  ])

  return (
    <CriarClient
      initialOccasions={initialOccasions}
      initialLivreDisponivel={livreDisponivel}
      initialPresenteDisponivel={presenteDisponivel}
    />
  )
}
