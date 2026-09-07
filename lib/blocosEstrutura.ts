// Blocos de estrutura oferecidos ao cliente — SÓ os que foram medidos.
//
// Cada um passou por um teste com controle: gera-se a mesma letra com e sem
// a marcação e mede-se o maior trecho sem voz. Aprovado = pelo menos 1,8x o
// silêncio normal daquele estilo, com no mínimo 15s, NAS DUAS versões
// geradas. Bloco que funciona numa e falha na outra fica de fora: recurso
// que entrega metade das vezes gera mais contestação do que valor.
//
// COMO SE MEDE (revisto em 2026-09-07): separação de fontes com Demucs, e o
// trecho instrumental é a maior janela em que o stem de VOZ fica mudo. Dois
// caminhos mais baratos foram tentados e descartados por não enxergarem nada:
// o alinhamento da própria API encadeia as palavras (no Rock, com solo
// confirmado, o maior buraco entre palavras deu 0,2s) e extração de canal
// central não separa nada porque a mixagem do Suno é quase mono (energia fora
// do centro = 8%). Validação do método: Rock controle 2,9/3,5s no meio contra
// 16,6/32,4s com [Solo de Guitarra] — o bloco aprovado antes segue aprovado.
//
// Medições de 2026-09-05 (segundos de trecho instrumental, por versão):
//   Rock       silêncio normal 8s   → Solo de Guitarra 33/27 · Riff 21/39 · Final Instrumental 47/38
//   Pagode     silêncio normal 6s   → Solo de Cavaquinho 25/22
//   Sertanejo  silêncio normal 11s  → Solo de Viola 22/43
//   MPB        silêncio normal 6s   → Solo de Piano 29/30 · Violão Solo 17/25 · Intro Instrumental 33/29
//   Gospel     silêncio normal 4s   → Solo de Órgão 29/22 · Solo de Violino 40/22
//
// Rodada de 2026-09-07 (Demucs; escolhida por volume de pedido):
//   Pop        silêncio normal 1,8s → Solo de Piano 18,8/26,1 ✅
//              Solo de Guitarra 13,1/17,8 — reprovado por 1,9s numa versão.
//              Afrouxar o piso DEPOIS de ver o resultado é mudar a régua pra
//              caber a peça; se um dia mudar, muda antes de medir.
//
// REPROVADOS, e por quê:
//   Solo de Bateria      — o Suno abre o espaço mas preenche com o
//                          instrumento dominante do estilo. Pedimos bateria e
//                          veio guitarra, nas 4 formulações testadas
//                          (português, inglês, estilo pedindo bateria, tag
//                          explícita). Análise espectral confirmou: perfil
//                          tonal, igual ao solo de guitarra.
//   Acordeon, Intro no Sertanejo, Piano no Gospel, Ponte no Pop
//                        — instáveis: funcionam numa versão e falham na outra.
//   Quebra de Percussão, Intro no Pagode
//                        — sem efeito medível.
//   Coral (Gospel)       — a densidade harmônica CAIU no trecho marcado
//                          (7,3 e 8,0 contra 12,8 do controle). Mais vozes
//                          deveriam adensar; o dado aponta o contrário.
//   Crescendo (Gospel)   — fez o OPOSTO do prometido: a energia DESCE no
//                          terço final (inclinação −0,73 e −0,63) enquanto
//                          no controle ela sobe (+0,18).
//   Dueto (Sertanejo)    — densidade 11,1 e 13,8 contra 14,6 do controle do
//                          mesmo estilo. Sem sinal de segunda voz.
//   Sintetizador, Final Instrumental (Pop) — instável e sem efeito.
//   Onda de 2026-09-07 — Forró, Hip-Hop, R&B e K-Pop seguem SEM bloco:
//     Sanfona (Forró) 0,5/4,9 e Intro (Forró) 0,0/10,8 — os dois ABAIXO do
//       próprio controle, que já tem 7s de respiro e 17s de introdução. Forró
//       é instrumental por natureza; pedir deu menos que não pedir.
//     Zabumba (Forró) 10,1/1,4 · Beat Instrumental (Hip-Hop) 3,3/20,9 ·
//       Solo de Piano (R&B) 3,3/14,4 · Solo de Guitarra (K-Pop) 20,0/3,2
//       — o padrão de sempre: funciona numa versão, falha na outra.
//     Scratch de DJ (Hip-Hop) 0,6/6,2 · Saxofone (R&B) 1,1/8,8 ·
//       Dance Break (K-Pop) 1,2/1,5 — não abrem espaço nenhum.
//   Build, Quebra Instrumental (Eletrônica) — o CONTROLE do gênero já tem
//                          31s de instrumental natural, então este método
//                          não consegue julgar. Eletrônica exige outra
//                          medição; não é "reprovado", é "não sei".
//
// Reggae, Eletrônica, Forró, Hip-Hop, R&B e K-Pop seguem sem bloco aprovado.
// Aparecer sem opção é melhor que oferecer algo que não acontece.
//
// O que a medição NÃO prova: qual instrumento toca no trecho. Ela mostra que
// há espaço sem canto, não que o espaço é de piano. Por isso todo bloco novo
// passa por escuta humana antes de entrar — foi assim que o solo de bateria
// caiu, e foi assim que o piano do Pop entrou (Audrei, 2026-09-07).

export type Bloco = { tag: string; label: string; ajuda: string }

const POR_ESTILO: { casa: RegExp; blocos: Bloco[] }[] = [
  { casa: /rock|metal|punk/i, blocos: [
    { tag: "Solo de Guitarra",   label: "Solo de guitarra",   ajuda: "um solo no meio da música" },
    { tag: "Riff de Guitarra",   label: "Riff de abertura",   ajuda: "começa com a guitarra" },
    { tag: "Final Instrumental", label: "Final instrumental", ajuda: "termina só com a banda" },
  ]},
  { casa: /pagode|samba/i, blocos: [
    { tag: "Solo de Cavaquinho", label: "Solo de cavaquinho", ajuda: "um solo no meio da música" },
  ]},
  { casa: /sertanejo|caipira/i, blocos: [
    { tag: "Solo de Viola", label: "Solo de viola", ajuda: "um solo no meio da música" },
  ]},
  { casa: /gospel|worship/i, blocos: [
    { tag: "Solo de Órgão",   label: "Solo de órgão",   ajuda: "um solo no meio da música" },
    { tag: "Solo de Violino", label: "Solo de violino", ajuda: "um solo no meio da música" },
  ]},
  // (?<!k-) exclui K-Pop: "Pop" casa dentro de "K-Pop", e no K-Pop este bloco
  // NÃO foi medido — o que testamos lá (dance break, solo de guitarra) reprovou.
  // "Pop Rock" cai na regra do rock, que vem antes e tem mais blocos.
  { casa: /(?<!k-)pop/i, blocos: [
    { tag: "Solo de Piano", label: "Solo de piano", ajuda: "um solo no meio da música" },
  ]},
  { casa: /mpb|bossa/i, blocos: [
    { tag: "Solo de Piano",      label: "Solo de piano",       ajuda: "um solo no meio da música" },
    { tag: "Violão Solo",        label: "Solo de violão",      ajuda: "um solo no meio da música" },
    { tag: "Intro Instrumental", label: "Intro instrumental",  ajuda: "começa sem voz" },
  ]},
]

export function blocosDoEstilo(estilo?: string | null): Bloco[] {
  if (!estilo) return []
  return POR_ESTILO.find((x) => x.casa.test(estilo))?.blocos ?? []
}

// Onde a marcação entra na letra.
//
// Antes do ÚLTIMO refrão — a mesma posição usada nos testes, e a que faz
// sentido musical: o solo separa o corpo da música do desfecho. A exceção é
// a intro, que só faz sentido no começo.
export function inserirBloco(letra: string, tag: string): string {
  if (letra.includes(`[${tag}]`)) return letra

  if (/intro/i.test(tag)) return `[${tag}]\n\n${letra.trimStart()}`

  const refroes = [...letra.matchAll(/^\[Refrão\]$/gm)]
  if (refroes.length === 0) return `${letra.trimEnd()}\n\n[${tag}]`
  const ultimo = refroes[refroes.length - 1]
  const pos = ultimo.index ?? 0
  return `${letra.slice(0, pos)}[${tag}]\n\n${letra.slice(pos)}`
}

export function removerBloco(letra: string, tag: string): string {
  return letra
    .replace(new RegExp(`^\\[${tag}\\]\\n*`, "gmi"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// Todas as tags oferecidas, de todos os gêneros.
const TODAS_AS_TAGS = POR_ESTILO.flatMap((x) => x.blocos.map((b) => b.tag))

// A letra SEM as marcações de bloco — é assim que ela é comparada com a
// última saída da IA. Marcar um solo não é "editar a letra": nenhum verso
// muda, é escolha de arranjo. Sem essa normalização o botão de bloco derruba
// o `canApprove`, e o cliente é mandado gastar uma das 3 revisões da IA pra
// "consertar" o que ele acabou de escolher — e a revisão reescreve a letra e
// leva a marcação junto, então a escolha dele some sem explicação.
export function semBlocos(letra: string): string {
  return TODAS_AS_TAGS.reduce((t, tag) => removerBloco(t, tag), letra)
}

// Quais blocos estão marcados agora — usado pra devolvê-los depois de uma
// revisão da IA, que reescreve o texto inteiro.
export function blocosMarcados(letra: string): string[] {
  return TODAS_AS_TAGS.filter((tag) => temBloco(letra, tag))
}

export function temBloco(letra: string, tag: string): boolean {
  return new RegExp(`^\\[${tag}\\]$`, "mi").test(letra)
}
