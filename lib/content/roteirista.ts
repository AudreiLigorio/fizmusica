import { generateLyrics } from "@/lib/composer/gemini"
import { getComposerSettings } from "@/lib/composer/settings"
import { loadMarca } from "@/lib/content/marca"
import { carregarLicoes } from "@/lib/content/licoes"
import { tabelaDeEstilos } from "@/lib/content/trilhas"
import { createServerClient } from "@/lib/supabase"

// Roteirista — o agente que decide O QUE contar antes de qualquer imagem ou
// música ser gerada. Duas passadas na mesma chamada de negócio:
//
//   1. criação  — escolhe persona + emoção-alvo, escreve história, gancho,
//                 legenda e (no formato vídeo) as cenas + a música;
//   2. revisão  — um crítico aplica o crivo de `marca/04-qualidade.md`, dá nota
//                 e devolve parecer. Reprovou, o roteirista reescreve UMA vez
//                 com as correções na mão.
//
// Duas passadas e não treze: os critérios do crivo são explícitos e
// verificáveis, então a crítica se paga. Mais hops seria custo sem retorno.

export type RoteiroFormato = "video" | "post"

export type RoteiroSource =
  | { type: "generico"; topic: string }
  | { type: "pedido"; subcategory: string; musicName: string; lyricsExcerpt: string }

export type RoteiroInput = {
  formato: RoteiroFormato
  platform: string
  source: RoteiroSource
  /**
   * Adaptação de uma peça que já existe para outra rede. A regra da base de
   * conhecimento vale aqui: muda o comprimento, o ritmo do gancho, o CTA e o
   * nível de contexto — NÃO muda a emoção-alvo, a persona nem a história. Se
   * a essência mudou, virou outra peça, não uma adaptação.
   */
  adaptarDe?: { historia: string; persona: string; emocao: string; hook: string; plataformaOriginal: string }
}

export type RoteiroCena = { description: string; caption: string }

export type Roteiro = {
  persona: string
  emocao: string
  historia: string
  hook: string
  caption: string
  hashtags: string
  cenas: RoteiroCena[]
  songTheme: string
  songStyle: string
}

export type ParecerItem = { pergunta: string; ok: boolean; observacao: string }

export type Parecer = {
  aprovado: boolean
  nota: number
  itens: ParecerItem[]
  correcoes: string
}

export type RoteiroResult = {
  roteiro: Roteiro
  parecer: Parecer
  tentativas: number
  /** true quando nem a reescrita passou no crivo — vai pro painel marcado. */
  precisaDeHumano: boolean
}

const NOTA_MINIMA = 7

function sourceToText(source: RoteiroSource): string {
  if (source.type === "pedido") {
    return (
      `Origem: história real de um cliente COM consentimento de publicação.\n` +
      `Tipo de homenagem: ${source.subcategory}\n` +
      `Nome da música: ${source.musicName}\n` +
      `Trecho da letra (inspiração — não copiar literalmente, não citar como depoimento):\n` +
      source.lyricsExcerpt.slice(0, 1200)
    )
  }
  return `Origem: tema livre de marketing.\nTema: ${source.topic}`
}

function criacaoSystemPrompt(formato: RoteiroFormato, licoes: string): string {
  const base =
    "Você é o roteirista-chefe da FizMusica, que transforma histórias reais em músicas personalizadas. " +
    "Seu trabalho é decidir O QUE contar e COMO contar antes de qualquer imagem ou música existir.\n\n" +
    "Siga RIGOROSAMENTE a base de conhecimento abaixo. Ela tem precedência sobre qualquer hábito seu " +
    "de escrita publicitária:\n\n<base_de_conhecimento>\n" +
    loadMarca(["voz", "personas", "ganchos", "redes"]) + licoes +
    "\n</base_de_conhecimento>\n\n" +
    "Antes de escrever, responda para si mesmo, nesta ordem: (1) qual emoção quero provocar; " +
    "(2) para qual persona estou falando; (3) qual história vou contar; (4) qual gancho interrompe " +
    "o scroll. Só então escreva.\n\n" +
    "Responda SOMENTE com um objeto JSON válido, sem markdown, sem crases, sem texto antes ou depois.\n\n"

  if (formato === "post") {
    return (
      base +
      "Formato do JSON:\n" +
      `{
  "persona": "<qual das personas da base, pelo nome>",
  "emocao": "<a emoção-alvo, uma palavra>",
  "historia": "<a história em 1 ou 2 frases — é o que a peça conta, não o produto>",
  "hook": "<4 a 8 palavras, sem ponto final, pra queimar na imagem>",
  "caption": "<no máximo 2 frases curtas, terminando com UM único CTA>",
  "hashtags": "<5 a 8 hashtags separadas por espaço, com #, em português>",
  "cenas": [],
  "songTheme": "",
  "songStyle": ""
}`
    )
  }

  return (
    base +
    tabelaDeEstilos() + "\n\n" +
    "Formato do JSON (vídeo de 3 a 6 cenas — cada cena vira uma imagem fotorrealista com uma legenda " +
    "sobreposta, na ordem em que aparecem; a última cena é o desfecho emocional, sincronizado com o " +
    "clímax da música):\n" +
    `{
  "persona": "<qual das personas da base, pelo nome>",
  "emocao": "<a emoção-alvo, uma palavra>",
  "historia": "<a história em 1 ou 2 frases>",
  "hook": "<4 a 8 palavras — é a legenda da PRIMEIRA cena, precisa prender em 2 segundos>",
  "caption": "<legenda do post, no máximo 2 frases, terminando com UM único CTA>",
  "hashtags": "<5 a 8 hashtags separadas por espaço, com #, em português>",
  "cenas": [
    {
      "description": "<descrição visual da cena para um gerador de imagem: quem aparece, onde, que expressão, que luz. Pessoas brasileiras, cena realista e cotidiana. NUNCA descreva texto escrito dentro da imagem>",
      "caption": "<a frase que aparece na tela nessa cena — curta, no máximo 10 palavras>"
    }
  ],
  "songTheme": "<tema da música que embala o vídeo, em uma frase>",
  "songStyle": "<estilo musical — copie o da tabela de estilos que corresponde à ocasião desta peça>"
}`
  )
}

function revisaoSystemPrompt(licoes: string): string {
  return (
    "Você é o revisor crítico de conteúdo da FizMusica. Você NÃO reescreve nada — você julga, e é " +
    "rigoroso de propósito: é mais barato reprovar aqui do que publicar conteúdo morno.\n\n" +
    "Aplique exatamente o crivo abaixo:\n\n<crivo>\n" +
    loadMarca(["qualidade", "voz"]) + licoes +
    "\n</crivo>\n\n" +
    "Responda SOMENTE com um objeto JSON válido, sem markdown, sem crases:\n" +
    `{
  "aprovado": <true se NENHUMA das 8 perguntas eliminatórias falhou E a nota for ${NOTA_MINIMA} ou mais>,
  "nota": <0 a 10>,
  "itens": [
    { "pergunta": "<a pergunta do crivo, resumida>", "ok": <true|false>, "observacao": "<uma linha>" }
  ],
  "correcoes": "<se reprovado: instrução objetiva do que corrigir, direto ao ponto. Se aprovado: string vazia>"
}`
  )
}

// A IA às vezes embrulha o JSON em cerca de markdown mesmo mandado não fazer.
function parseJson<T>(raw: string, oQue: string): T {
  const limpo = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
  const inicio = limpo.indexOf("{")
  const fim = limpo.lastIndexOf("}")
  if (inicio === -1 || fim === -1) throw new Error(`A IA não retornou ${oQue} em JSON.`)
  try {
    return JSON.parse(limpo.slice(inicio, fim + 1)) as T
  } catch {
    throw new Error(`A IA retornou ${oQue} em JSON inválido.`)
  }
}

function validarRoteiro(r: Roteiro, formato: RoteiroFormato): void {
  if (!r.hook?.trim()) throw new Error("Roteiro sem gancho.")
  if (!r.caption?.trim()) throw new Error("Roteiro sem legenda.")
  if (!r.emocao?.trim()) throw new Error("Roteiro sem emoção-alvo — regra da emoção obrigatória.")
  if (formato === "video") {
    if (!Array.isArray(r.cenas) || r.cenas.length < 3 || r.cenas.length > 6) {
      throw new Error("Roteiro de vídeo precisa ter entre 3 e 6 cenas.")
    }
    if (r.cenas.some((c) => !c.description?.trim() || !c.caption?.trim())) {
      throw new Error("Toda cena precisa de descrição visual e legenda.")
    }
    if (!r.songTheme?.trim() || !r.songStyle?.trim()) {
      throw new Error("Roteiro de vídeo precisa de tema e estilo da música.")
    }
  }
}

type Gemini = { model: string; location: string; licoes: string }

async function criar(
  gemini: Gemini,
  input: RoteiroInput,
  correcoes?: { anterior: Roteiro; parecer: Parecer },
): Promise<Roteiro> {
  let userContent =
    `Plataforma-alvo: ${input.platform}\n` +
    `Formato: ${input.formato === "video" ? "vídeo multi-cena" : "post estático"}\n` +
    sourceToText(input.source)

  if (input.adaptarDe) {
    userContent +=
      `\n\n--- ADAPTAÇÃO DE REDE ---\n` +
      `Esta peça já existe para ${input.adaptarDe.plataformaOriginal} e vai ser adaptada para ` +
      `${input.platform}. MANTENHA a mesma emoção-alvo (${input.adaptarDe.emocao}), a mesma persona ` +
      `(${input.adaptarDe.persona}) e a MESMA HISTÓRIA:\n"${input.adaptarDe.historia}"\n\n` +
      `MUDE o que a rede de destino exige: comprimento, ritmo do gancho, nível de contexto e CTA. ` +
      `O gancho precisa ser NOVO — não repita "${input.adaptarDe.hook}", porque a mesma frase nas duas ` +
      `redes é conteúdo duplicado, não adaptação.`
  }

  if (correcoes) {
    userContent +=
      `\n\n--- REESCRITA ---\n` +
      `O roteiro abaixo FOI REPROVADO pelo revisor. Reescreva corrigindo exatamente o que ele apontou. ` +
      `Não repita os mesmos erros e não entregue uma variação cosmética.\n\n` +
      `Roteiro reprovado:\n${JSON.stringify(correcoes.anterior, null, 2)}\n\n` +
      `Parecer do revisor (nota ${correcoes.parecer.nota}):\n${correcoes.parecer.correcoes}\n` +
      correcoes.parecer.itens
        .filter((i) => !i.ok)
        .map((i) => `- FALHOU: ${i.pergunta} — ${i.observacao}`)
        .join("\n")
  }

  const raw = await generateLyrics({
    systemPrompt: criacaoSystemPrompt(input.formato, gemini.licoes),
    model: gemini.model,
    location: gemini.location,
    userContent,
  })

  const roteiro = parseJson<Roteiro>(raw, "o roteiro")
  roteiro.cenas = roteiro.cenas ?? []
  validarRoteiro(roteiro, input.formato)
  return roteiro
}

async function revisar(gemini: Gemini, input: RoteiroInput, roteiro: Roteiro): Promise<Parecer> {
  const raw = await generateLyrics({
    systemPrompt: revisaoSystemPrompt(gemini.licoes),
    model: gemini.model,
    location: gemini.location,
    userContent:
      `Plataforma: ${input.platform}\nFormato: ${input.formato}\n\n` +
      `Roteiro a julgar:\n${JSON.stringify(roteiro, null, 2)}`,
  })

  const parecer = parseJson<Parecer>(raw, "o parecer")
  parecer.itens = parecer.itens ?? []
  parecer.nota = Number(parecer.nota) || 0
  // O veredito é nosso, não da IA: mesmo que ela diga "aprovado", a regra de
  // nota mínima e de item eliminatório vale.
  parecer.aprovado = parecer.aprovado === true && parecer.nota >= NOTA_MINIMA && parecer.itens.every((i) => i.ok)
  return parecer
}

// Ponto de entrada: cria, revisa e — se reprovado — reescreve UMA vez.
export async function gerarRoteiro(input: RoteiroInput): Promise<RoteiroResult> {
  const settings = await getComposerSettings()
  // As lições entram junto da base de conhecimento, nos DOIS agentes: quem
  // escreve para não repetir o erro, e quem revisa para saber cobrá-lo.
  const licoes = await carregarLicoes(createServerClient())
  const gemini: Gemini = { model: settings.model, location: settings.location, licoes }

  const roteiro1 = await criar(gemini, input)
  const parecer1 = await revisar(gemini, input, roteiro1)
  if (parecer1.aprovado) {
    return { roteiro: roteiro1, parecer: parecer1, tentativas: 1, precisaDeHumano: false }
  }

  const roteiro2 = await criar(gemini, input, { anterior: roteiro1, parecer: parecer1 })
  const parecer2 = await revisar(gemini, input, roteiro2)

  // Reprovou duas vezes: entrega assim mesmo, marcado — quem decide é o admin.
  // Descartar o trabalho seria pior: ele ainda serve de ponto de partida.
  return {
    roteiro: roteiro2,
    parecer: parecer2,
    tentativas: 2,
    precisaDeHumano: !parecer2.aprovado,
  }
}
