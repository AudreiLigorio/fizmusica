// Blocos de estrutura oferecidos ao cliente — SÓ os que foram medidos.
//
// CRITÉRIO. Gera-se a mesma letra com e sem a marcação e mede-se o trecho
// instrumental. Aprovado = pelo menos 1,8x o respiro normal do gênero, com no
// mínimo 15s, em TODAS as amostras — não na média. Bloco que funciona numa
// versão e falha na outra fica de fora: recurso que entrega metade das vezes
// gera mais contestação do que valor.
//
// "Respiro normal do gênero" é a MEDIANA das amostras do controle, não o
// maior valor (mudado em 2026-09-07). O máximo é um sorteio só, e um sorteio
// ruim levanta a barra sem motivo: o controle do Sertanejo veio 13,2 · 2,5 ·
// 5,5 · 3,8 — o 13,2 sozinho exigiria 23,8s de qualquer candidato daquele
// gênero. A troca mudou exatamente UM veredito (a viola do Sertanejo, que sai
// em 100% das amostras e nunca abaixo de 17s). Nada mais foi resgatado por
// ela: o que reprova, reprova por não sair sempre.
//
// COMO SE MEDE (revisto em 2026-09-07): separação de fontes com Demucs, e o
// trecho instrumental é a maior janela em que o stem de VOZ fica mudo. Dois
// caminhos mais baratos foram tentados e descartados por não enxergarem nada:
// o alinhamento da própria API encadeia as palavras (no Rock, com solo
// confirmado, o maior buraco entre palavras deu 0,2s) e extração de canal
// central não separa porque a mixagem do Suno é quase mono (energia fora do
// centro = 8%). Validação do método antes de usar: Rock controle 2,9/3,5s
// contra 16,6/32,4s com [Solo de Guitarra].
//
// O QUE A MEDIÇÃO NÃO PROVA: qual instrumento toca no trecho. Ela mostra que
// há espaço sem canto, não que o espaço é de piano. Por isso todo bloco novo
// passa por escuta humana antes de entrar — foi assim que o solo de bateria
// caiu, e foi assim que o piano do Pop entrou (Audrei, 2026-09-07).
//
// APROVADOS (segundos de trecho instrumental, por amostra):
//   Rock      respiro 3,2s   → Solo de Guitarra 16,6/32,4 · Riff 22,5/21,7 ·
//                              Final Instrumental 22,1/25,7
//   MPB       respiro 5,2s   → Solo de Piano 31,6/22,2 · Violão Solo 33,3/16,4
//   Pop       respiro 1,8s   → Solo de Piano 18,8/26,1
//   Sertanejo respiro 4,7s   → Solo de Viola 19,6/17,2/34,9/23,5
//   Gospel    respiro 1,8s   → Solo de Violino 1,7/17,6/15,8/22,7  ⚠ ver abaixo
//
// ⚠ EXCEÇÃO CONSCIENTE — Solo de Violino (Gospel). Falhou uma das quatro
// amostras (1,7s). Pela regra sairia; o Audrei decidiu manter em 2026-09-07,
// porque funciona em 3 de 4 e é o único bloco que o Gospel tem (13 pedidos).
// É o único item desta lista que não cumpre o próprio critério — se aparecer
// contestação de "pedi o violino e não veio", este é o primeiro suspeito.
//
// REMOVIDOS em 2026-09-07, depois de revalidação com o método novo:
//   Solo de Cavaquinho (Pagode) 1,2/24,5/2,3/27,4 — sai em 2 de 4, e quando
//     não sai, não sai nada. Pagode e Samba voltaram a não ter seção.
//   Solo de Órgão (Gospel) 16,0/6,2/3,8/2,2 — funcionou 1 vez em 4.
//   Intro Instrumental (MPB) 0,1/0,1 contra 17,0s do controle — EFEITO
//     REVERSO: pedir a intro CANCELA a introdução natural. O Forró repetiu o
//     sinal (0,0/10,8 contra 17,2). Dois gêneros independentes, mesma
//     direção: o modelo parece ler a tag como "a música começa aqui". Não
//     tentar de novo sem mudar a formulação.
//
// REPROVADOS em rodadas anteriores, e por quê:
//   Solo de Bateria      — o Suno abre o espaço mas preenche com o
//                          instrumento dominante do estilo. Pedimos bateria e
//                          veio guitarra, nas 4 formulações testadas
//                          (português, inglês, estilo pedindo bateria, tag
//                          explícita). Análise espectral confirmou: perfil
//                          tonal, igual ao solo de guitarra.
//   Acordeon, Intro no Sertanejo, Piano no Gospel, Ponte no Pop — instáveis.
//   Quebra de Percussão, Intro no Pagode — sem efeito medível.
//   Coral (Gospel)       — a densidade harmônica CAIU no trecho marcado
//                          (7,3 e 8,0 contra 12,8 do controle).
//   Crescendo (Gospel)   — a energia DESCE no terço final (−0,73 e −0,63)
//                          enquanto no controle ela sobe (+0,18).
//   Dueto (Sertanejo)    — densidade 11,1 e 13,8 contra 14,6 do controle.
//   Sintetizador, Final Instrumental e Solo de Guitarra (Pop) — os dois
//                          primeiros instáveis; a guitarra parou em 13,1s numa
//                          das versões, 1,9s abaixo do piso. Reprovada de
//                          propósito: afrouxar a régua DEPOIS de ver o
//                          resultado é mudar a régua pra caber a peça.
//   Sanfona e Intro (Forró) 0,5/4,9 e 0,0/10,8 — ABAIXO do próprio controle,
//                          que já tem 7s de respiro e 17s de introdução. Forró
//                          é instrumental por natureza: pedir deu menos que
//                          não pedir. Zabumba 10,1/1,4, instável.
//   Beat Instrumental (Hip-Hop) 3,3/20,9 · Solo de Piano (R&B) 3,3/14,4 ·
//     Solo de Guitarra (K-Pop) 20,0/3,2 — funcionam numa versão, falham na
//     outra. Scratch de DJ 0,6/6,2 · Saxofone (R&B) 1,1/8,8 · Dance Break
//     (K-Pop) 1,2/1,5 — não abrem espaço nenhum.
//   Build, Quebra Instrumental (Eletrônica) — o CONTROLE do gênero já tem 31s
//                          de instrumental natural, então este método não
//                          consegue julgar. Não é "reprovado", é "não sei".
//
// Pagode, Samba, Forró, Hip-Hop, R&B, K-Pop, Reggae e Eletrônica seguem sem
// bloco aprovado. Aparecer sem opção é melhor que oferecer algo que não
// acontece.

export type Bloco = { tag: string; label: string; ajuda: string }

const POR_ESTILO: { casa: RegExp; blocos: Bloco[] }[] = [
  { casa: /rock|metal|punk/i, blocos: [
    { tag: "Solo de Guitarra",   label: "Solo de guitarra",   ajuda: "um solo no meio da música" },
    { tag: "Riff de Guitarra",   label: "Riff de abertura",   ajuda: "começa com a guitarra" },
    { tag: "Final Instrumental", label: "Final instrumental", ajuda: "termina só com a banda" },
  ]},
  { casa: /sertanejo|caipira/i, blocos: [
    { tag: "Solo de Viola", label: "Solo de viola", ajuda: "um solo no meio da música" },
  ]},
  { casa: /gospel|worship/i, blocos: [
    { tag: "Solo de Violino", label: "Solo de violino", ajuda: "um solo no meio da música" },
  ]},
  // (?<!k-) exclui K-Pop: "Pop" casa dentro de "K-Pop", e no K-Pop este bloco
  // NÃO foi medido — o que testamos lá (dance break, solo de guitarra) reprovou.
  // "Pop Rock" cai na regra do rock, que vem antes e tem mais blocos.
  { casa: /(?<!k-)pop/i, blocos: [
    { tag: "Solo de Piano", label: "Solo de piano", ajuda: "um solo no meio da música" },
  ]},
  { casa: /mpb|bossa/i, blocos: [
    { tag: "Solo de Piano", label: "Solo de piano",  ajuda: "um solo no meio da música" },
    { tag: "Violão Solo",   label: "Solo de violão", ajuda: "um solo no meio da música" },
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

// Tags que já foram oferecidas e não são mais. Elas continuam aqui de
// propósito: quem marcou o cavaquinho ANTES da remoção tem a marcação dentro
// da letra dele, e o botão pra desmarcar não existe mais. Se a normalização
// deixasse de conhecê-la, essa letra passaria a divergir da última saída da
// IA e o portão de aprovação travaria — o cliente ficaria preso, sem nada na
// tela explicando por quê. Só sai daqui quando não houver pedido aberto com
// a marcação.
const TAGS_APOSENTADAS = ["Solo de Cavaquinho", "Solo de Órgão", "Intro Instrumental"]

// Todas as tags que a letra pode conter — oferecidas hoje ou não.
const TODAS_AS_TAGS = [...POR_ESTILO.flatMap((x) => x.blocos.map((b) => b.tag)), ...TAGS_APOSENTADAS]

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
