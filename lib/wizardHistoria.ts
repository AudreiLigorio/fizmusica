// ── Wizard "campo primeiro" (versão B do teste A/B de 2026-11) ──
//
// Arquivo compartilhado entre navegador e servidor. NÃO importar nada de
// servidor aqui (supabase, crypto, next/headers): o CriarClient usa.
//
// O que é a versão B
//   A versão A (a de sempre) pergunta: tema → subtema → 2-3 perguntas fixas
//   do subtema → estilo → dados → refrão → produto → pagamento.
//   A versão B pergunta: para quem + a história num campo aberto → (só se a
//   história vier curta) UMA pergunta escrita pela IA → estilo (igual) →
//   refrão (igual) → dados (iguais, mas DEPOIS do refrão) → produto →
//   pagamento (iguais). O tema/subtema é escolhido pela IA a partir do texto
//   (`/api/wizard/historia`) e a pessoa pode trocar.
//
// Por que a B não quebra o resto do sistema
//   Ela grava EXATAMENTE os mesmos campos que a A: `context`, `subcategory`
//   (labels reais do catálogo), `answers` (pergunta → resposta), estilo, voz,
//   emoção, dados. A única diferença é QUAIS perguntas existem: em vez das
//   perguntas do subtema, as perguntas são PERGUNTA_HISTORIA e, se houver, a
//   pergunta extra da IA. Daí pra frente tudo é o mesmo código:
//   - a prévia monta o contexto da sessão (lib/composer/context.ts →
//     buildSessionContext, que sabe ordenar as perguntas da B);
//   - o pedido grava order_answers com `position` 0 e 1, e buildOrderContext
//     lê na mesma ordem — o contexto da prévia e o do pedido saem iguais byte
//     a byte, então a letra da prévia é reaproveitada (aproveitarPrevia.ts);
//   - letra pós-pagamento, Suno, admin, player: nada muda.
//
// Desligar o teste: AB_HISTORIA.ativo = false. Todo mundo volta à A na
// próxima visita, inclusive quem tinha sorteado B (o cookie é ignorado).
// Sessões B em andamento continuam funcionando (a sessão guarda o modo).

/** Rótulo da pergunta principal da B, como fica gravado em order_answers. */
export const PERGUNTA_HISTORIA = "Conte a história"

/**
 * Perguntas da B, NA ORDEM em que entram no contexto da letra. Fonte única:
 * usada pelo wizard (lista de perguntas, envio do pedido) e pelo servidor
 * (ordem das respostas na prévia). Se as duas divergirem, a prévia gera um
 * contexto diferente do pedido e a letra vista antes de pagar é descartada.
 */
export function perguntasDaHistoria(perguntaExtra?: string | null): string[] {
  const extra = (perguntaExtra ?? "").trim()
  return extra ? [PERGUNTA_HISTORIA, extra] : [PERGUNTA_HISTORIA]
}

/** Sessão/pedido que veio da B, reconhecido pelas próprias respostas. */
export function ehRespostaDaHistoria(perguntas: string[]): boolean {
  return perguntas[0] === PERGUNTA_HISTORIA
}

// Tamanho da história. O mínimo é baixo de propósito (quem escreve pouco
// ganha a pergunta extra); o máximo protege a chamada da IA.
export const HISTORIA_MIN = 30
export const HISTORIA_MAX = 4000
export const PERGUNTA_EXTRA_MAX = 160

/** Atalhos de ocasião da 1ª tela. São só DICA para a IA, não o tema gravado. */
export const DICAS_OCASIAO = ["Namoro", "Aniversário", "Mãe ou pai", "Amizade", "Casamento", "Outra"] as const

// ── Sorteio A/B ──
//
// Quem entra: só quem chega DIRETO no /criar com utm_ na URL (anúncio) e não
// está retomando pedido (orderId/sessao/editar). Visita vinda da home, do app
// ou de link de e-mail fica sempre na A.
//
// Onde é decidido: no SERVIDOR (app/criar/page.tsx), pelo cookie abaixo. Se o
// sorteio fosse no navegador, a página chegaria desenhada como A e trocaria
// para B depois de carregar o JavaScript — e os primeiros segundos são
// justamente onde o anúncio perde gente. O navegador só grava o cookie que o
// servidor sorteou, pra pessoa cair na mesma versão se voltar.
//
// Forçar uma versão (teste manual): ?ab=A ou ?ab=B na URL.
export const AB_HISTORIA = {
  ativo: true,
  /** Fração do tráfego elegível que vê a B. */
  fracaoB: 0.5,
  cookie: "fm_ab_historia",
  /** Cookie vale 30 dias: a mesma pessoa volta pela mesma versão. */
  cookieDias: 30,
} as const

export type VarianteHistoria = "A" | "B"

export function decidirVarianteHistoria(opts: {
  elegivel: boolean
  cookie?: string | null
  forcar?: string | null
  sorteio: number
}): VarianteHistoria | null {
  if (!AB_HISTORIA.ativo || !opts.elegivel) return null
  if (opts.forcar === "A" || opts.forcar === "B") return opts.forcar
  if (opts.cookie === "A" || opts.cookie === "B") return opts.cookie
  return opts.sorteio < AB_HISTORIA.fracaoB ? "B" : "A"
}
