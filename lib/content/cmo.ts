import { generateLyrics } from "@/lib/composer/gemini"
import { getComposerSettings } from "@/lib/composer/settings"
import type { createServerClient } from "@/lib/supabase"
import { loadMarca } from "@/lib/content/marca"
import { datasProximas } from "@/lib/content/calendario"
import { carregarLicoes } from "@/lib/content/licoes"

type DB = ReturnType<typeof createServerClient>

// Diretor de marketing. Não escreve peça nenhuma — decide O QUE produzir hoje
// e passa a ordem pro roteirista. Só existe porque tem do que se alimentar:
// calendário de sazonalidade, o que já foi publicado (pra não repetir) e os
// cliques de cada peça. Agente sem dado seria prompt caro com etapa a mais.

export type ContentSettings = {
  modo: "manual" | "semi" | "auto"
  dias_semana: number[]
  plataformas: string[]
  nota_minima_auto: number
  luto_sempre_manual: boolean
  pedido_real_manual: boolean
  teto_semanal: number
}

const PADRAO: ContentSettings = {
  modo: "manual",
  dias_semana: [1, 3, 5, 6],
  plataformas: ["instagram"],
  nota_minima_auto: 8,
  luto_sempre_manual: true,
  pedido_real_manual: true,
  teto_semanal: 5,
}

export async function getContentSettings(supabase: DB): Promise<ContentSettings> {
  const { data } = await supabase.from("content_settings").select("*").eq("id", 1).maybeSingle()
  return data ? { ...PADRAO, ...data } : PADRAO
}

export type Briefing = {
  tema: string
  plataforma: string
  angulo: string
  justificativa: string
}

// Histórico recente: o que já foi produzido e o que cada peça rendeu de
// cliques. É o que impede o CMO de repetir o mesmo tema toda semana e o que
// permite ele insistir no que funcionou.
async function contextoRecente(supabase: DB): Promise<string> {
  const { data: drafts } = await supabase
    .from("content_drafts")
    .select("id, topic, emocao_alvo, persona, platform, status, created_at")
    .order("created_at", { ascending: false })
    .limit(12)

  if (!drafts?.length) return "Nenhuma peça produzida ainda — este é o começo."

  const { data: links } = await supabase.from("content_links").select("id, draft_id")
  const { data: clicks } = await supabase.from("content_link_clicks").select("link_id")

  const cliquesPor = (draftId: string) => {
    const link = (links ?? []).find((l) => l.draft_id === draftId)
    if (!link) return 0
    return (clicks ?? []).filter((c) => c.link_id === link.id).length
  }

  return drafts
    .map((d) => {
      const quando = d.created_at?.slice(0, 10) ?? "?"
      return `- ${quando} | ${d.platform} | tema: ${d.topic ?? "de pedido real"} | emoção: ${d.emocao_alvo ?? "?"} | status: ${d.status} | cliques: ${cliquesPor(d.id)}`
    })
    .join("\n")
}

function systemPrompt(licoes: string): string {
  return (
    "Você é o diretor de marketing (CMO) da FizMusica, que transforma histórias reais em músicas " +
    "personalizadas. Você NÃO escreve conteúdo — você decide o que deve ser produzido hoje e passa a " +
    "ordem para o roteirista.\n\n" +
    "Conheça a marca e o público:\n\n<base_de_conhecimento>\n" +
    loadMarca(["voz", "personas", "redes"]) + licoes +
    "\n</base_de_conhecimento>\n\n" +
    "Critérios de decisão, em ordem de peso:\n" +
    "1. SAZONALIDADE: data comemorativa próxima manda. Quanto mais perto, mais óbvia a escolha — mas " +
    "não repita o mesmo ângulo da peça anterior sobre a mesma data.\n" +
    "2. NÃO REPETIR: olhe o histórico. Se as últimas peças foram todas sobre a mesma persona ou a " +
    "mesma emoção, mude — feed repetitivo perde alcance.\n" +
    "3. O QUE FUNCIONOU: peça com mais cliques indica tema que interessa. Vale insistir no assunto com " +
    "ângulo novo.\n" +
    "4. FORA DE DATA COMEMORATIVA: use as ocasiões do dia a dia (bodas, pedido de casamento, chá " +
    "revelação, homenagem a avós, aposentadoria, pet), que acontecem o ano inteiro.\n\n" +
    "Responda SOMENTE com um objeto JSON válido, sem markdown e sem crases:\n" +
    `{
  "tema": "<o tema da peça, em uma frase, do jeito que seria digitado no painel>",
  "plataforma": "<uma das plataformas permitidas>",
  "angulo": "<o ângulo específico: que recorte da história contar, pra não repetir o que já foi feito>",
  "justificativa": "<por que ESTE tema HOJE, em uma frase — será lido por uma pessoa depois>"
}`
  )
}

export async function decidirPauta(supabase: DB, plataformas: string[]): Promise<Briefing> {
  const settings = await getComposerSettings()
  const hoje = new Date()
  const datas = datasProximas(hoje)

  const userContent =
    `Data de hoje: ${hoje.toISOString().slice(0, 10)}\n` +
    `Plataformas permitidas: ${plataformas.join(", ")}\n\n` +
    `Datas comemorativas na janela:\n` +
    (datas.length
      ? datas.map((d) => `- ${d.nome}: faltam ${d.diasRestantes} dias (tema natural: ${d.tema})`).join("\n")
      : "- nenhuma data próxima; escolha uma ocasião do dia a dia") +
    `\n\nHistórico recente (mais nova primeiro):\n${await contextoRecente(supabase)}`

  const raw = await generateLyrics({
    systemPrompt: systemPrompt(await carregarLicoes(supabase)),
    model: settings.model,
    location: settings.location,
    userContent,
  })

  const limpo = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
  const inicio = limpo.indexOf("{")
  const fim = limpo.lastIndexOf("}")
  if (inicio === -1 || fim === -1) throw new Error("O CMO não retornou pauta em JSON.")

  const briefing = JSON.parse(limpo.slice(inicio, fim + 1)) as Briefing
  if (!briefing.tema?.trim()) throw new Error("O CMO não definiu tema.")
  // Plataforma fora da lista permitida vira a primeira permitida — a decisão
  // de onde publicar é do admin (parametrização), não da IA.
  if (!plataformas.includes(briefing.plataforma)) briefing.plataforma = plataformas[0]

  return briefing
}
