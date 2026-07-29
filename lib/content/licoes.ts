import { generateLyrics } from "@/lib/composer/gemini"
import { getComposerSettings } from "@/lib/composer/settings"
import type { createServerClient } from "@/lib/supabase"

type DB = ReturnType<typeof createServerClient>

// Lições aprendidas — o único ponto do sistema em que ele muda de
// comportamento sem alguém editar código.
//
// A crítica do admin ao rejeitar uma peça é específica ("a cena 1 mostrou o
// pai jovem demais"). Guardada assim, ela só serviria pra aquela peça. Então
// um passo de IA a transforma em REGRA generalizável ("em homenagem a pai,
// mostrar homem acima de 55 anos"), e é essa regra que entra nos prompts.
//
// Por decisão do usuário a lição entra em vigor SEM etapa de aprovação. Duas
// contrapartidas foram embutidas pra isso não virar caixa-preta:
//   1. a lista é visível e desativável no painel;
//   2. entram no máximo LIMITE lições nos prompts, as mais recentes — senão o
//      prompt cresce sem teto e as regras velhas afogam as novas.
const LIMITE = 20

const SYSTEM =
  "Você transforma a crítica de um editor a uma peça de conteúdo em uma REGRA reaproveitável para " +
  "produções futuras da FizMusica.\n\n" +
  "Regras da sua resposta:\n" +
  "- Generalize: a regra vale para peças futuras, não só para aquela. Não cite o tema específico da " +
  "peça a menos que a regra só faça sentido nele.\n" +
  "- Seja acionável e verificável: diga o que FAZER ou o que NÃO fazer, não uma opinião vaga.\n" +
  "- Uma frase, no imperativo, em português. Sem preâmbulo, sem aspas, sem explicação.\n" +
  "- Se a crítica for específica demais para virar regra (ex.: 'não gostei'), responda exatamente: IGNORAR"

/** Converte a crítica crua numa regra. Devolve null quando não dá pra generalizar. */
export async function gerarLicao(feedback: string, contexto: string): Promise<string | null> {
  if (!feedback.trim()) return null

  const settings = await getComposerSettings()
  const raw = await generateLyrics({
    systemPrompt: SYSTEM,
    model: settings.model,
    location: settings.location,
    userContent: `Peça criticada:\n${contexto}\n\nCrítica do editor:\n${feedback}`,
  })

  const regra = raw.trim().replace(/^["'\s]+|["'\s]+$/g, "")
  if (!regra || /^IGNORAR$/i.test(regra) || regra.length > 300) return null
  return regra
}

/** Registra a lição. Falhar aqui nunca pode impedir a rejeição da peça. */
export async function registrarLicao(
  supabase: DB,
  { feedback, contexto }: { feedback: string; contexto: string },
): Promise<string | null> {
  try {
    const regra = await gerarLicao(feedback, contexto)
    if (!regra) return null
    const { error } = await supabase
      .from("content_licoes")
      .insert({ regra, feedback_original: feedback, origem_draft: contexto.slice(0, 200) })
    if (error) throw new Error(error.message)
    return regra
  } catch (e) {
    console.error("[licoes] não consegui registrar:", e instanceof Error ? e.message : e)
    return null
  }
}

/** Bloco pronto pra injetar no prompt. String vazia quando não há lições. */
export async function carregarLicoes(supabase: DB): Promise<string> {
  try {
    const { data } = await supabase
      .from("content_licoes")
      .select("regra")
      .eq("ativa", true)
      .order("created_at", { ascending: false })
      .limit(LIMITE)

    if (!data?.length) return ""

    return (
      "\n\n---\n\n## Lições aprendidas (correções do editor em peças anteriores)\n\n" +
      "Estas vieram de erros reais já cometidos e apontados. Têm o mesmo peso das regras acima:\n\n" +
      data.map((l) => `- ${l.regra}`).join("\n")
    )
  } catch {
    return ""
  }
}
