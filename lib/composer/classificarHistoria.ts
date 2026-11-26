import { getWizardOccasions } from "@/lib/wizard"
import { getComposerSettings } from "@/lib/composer/settings"
import { gerarJson } from "@/lib/composer/gemini"
import { PERGUNTA_EXTRA_MAX } from "@/lib/wizardHistoria"

// ── Wizard "campo primeiro" (versão B): tema e pergunta extra pela IA ──
//
// Recebe a história livre e devolve:
//   - o tema e o subtema, ESCOLHIDOS ENTRE OS LABELS REAIS do catálogo do
//     wizard (o modelo responde o NÚMERO da opção, nunca escreve o label — um
//     label inventado ou com acento diferente quebraria o contexto da letra,
//     o admin e o filtro de ocasião). Número fora da lista = falha.
//   - uma pergunta extra, só quando a história veio sem detalhe concreto.
//
// Falhou (Gemini fora, timeout, resposta estranha)? Devolve null e o wizard
// pede pra pessoa escolher o tema numa lista — nunca trava a jornada.

// A "Composição Livre" fica fora: na B a pessoa veio pra homenagear alguém
// (e a letra pronta tem a porta dela, o link "Já tem a letra pronta?").
const FORA = "Composição Livre"

// História longa já tem detalhe de sobra: não pergunta nada, mesmo que o
// modelo sugira. Evita uma tela a mais pra quem já se empenhou.
const SEM_PERGUNTA_ACIMA_DE = 600

const TIMEOUT_MS = 12_000

export type Classificacao = {
  context: string
  subcategory: string
  pergunta: string | null
}

type Opcao = { context: string; subcategory: string }

// Catálogo em memória por 5 min (mesmo prazo do /criar): sem isso cada
// história esperava uma consulta a mais antes de chegar no Gemini.
let cacheOpcoes: { em: number; opcoes: Opcao[] } | null = null
async function opcoesDoCatalogo(): Promise<Opcao[]> {
  if (cacheOpcoes && Date.now() - cacheOpcoes.em < 5 * 60 * 1000) return cacheOpcoes.opcoes
  const ocasioes = await getWizardOccasions()
  const opcoes = ocasioes
    .filter((o) => o.label !== FORA)
    .flatMap((o) => o.wizard_subcategories.map((s) => ({ context: o.label, subcategory: s.label })))
  if (opcoes.length) cacheOpcoes = { em: Date.now(), opcoes }
  return opcoes
}

const PROMPT = `Você ajuda um site brasileiro que transforma histórias em músicas personalizadas.
Recebe a história que a pessoa escreveu, o nome de quem vai receber a música, uma dica opcional de ocasião e uma lista NUMERADA de ocasiões.

Responda SOMENTE um JSON: {"opcao": <número>, "pergunta": <texto ou null>}

"opcao": o número da ocasião da lista que melhor descreve a música. Na dúvida entre parecidas, prefira a mais geral. Se nada encaixar, escolha a que mais se aproxima.

"pergunta": UMA pergunta para enriquecer a letra, OU null.
- Use null quando a história já tem detalhes concretos (um momento, um lugar, um jeito da pessoa, algo que viveram).
- Faça a pergunta quando a história for genérica (ex.: "ela é especial, amo muito").
- A pergunta pede um detalhe concreto que FALTA, em português do Brasil, tom carinhoso e simples, até 110 caracteres, termina com "?".
- Use o nome de quem vai receber quando soar natural. Não repita o que a pessoa já contou.`

/**
 * Aquece a função e os caches (catálogo + configurações) enquanto a pessoa
 * ainda digita. Medido no ar em 26/11: 1ª chamada depois de um tempo parado
 * ~8 s; aquecida, ~2 s. O wizard chama no 1º caractere digitado.
 */
export async function aquecerClassificacao(): Promise<void> {
  await Promise.all([opcoesDoCatalogo(), getComposerSettings()]).catch(() => {})
}

export async function classificarHistoria(opts: {
  historia: string
  nome: string
  dica?: string | null
}): Promise<Classificacao | null> {
  try {
    const [opcoes, settings] = await Promise.all([opcoesDoCatalogo(), getComposerSettings()])
    if (!opcoes.length) return null

    const lista = opcoes.map((o, i) => `${i + 1}. ${o.context} — ${o.subcategory}`).join("\n")
    const userContent = [
      `NOME DE QUEM VAI RECEBER: ${opts.nome}`,
      opts.dica ? `DICA DE OCASIÃO ESCOLHIDA PELA PESSOA: ${opts.dica}` : "",
      "",
      "HISTÓRIA:",
      opts.historia,
      "",
      "OCASIÕES:",
      lista,
    ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n")

    const resposta = await Promise.race([
      gerarJson({ systemPrompt: PROMPT, model: settings.model, location: settings.location, userContent }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
    ]) as { opcao?: unknown; pergunta?: unknown } | null

    const n = Number(resposta?.opcao)
    const escolhida = Number.isInteger(n) ? opcoes[n - 1] : undefined
    if (!escolhida) return null

    let pergunta = typeof resposta?.pergunta === "string" ? resposta.pergunta.trim() : ""
    if (opts.historia.length > SEM_PERGUNTA_ACIMA_DE) pergunta = ""
    if (pergunta && !pergunta.endsWith("?")) pergunta += "?"
    if (pergunta.length > PERGUNTA_EXTRA_MAX) pergunta = ""

    return { context: escolhida.context, subcategory: escolhida.subcategory, pergunta: pergunta || null }
  } catch (e) {
    console.error("[classificarHistoria]", e instanceof Error ? e.message : e)
    return null
  }
}
