// Blocos de estrutura oferecidos ao cliente — SÓ os que foram medidos.
//
// Cada um passou por um teste com controle: gera-se a mesma letra com e sem
// a marcação e mede-se o maior trecho sem voz. Aprovado = pelo menos 1,8x o
// silêncio normal daquele estilo, com no mínimo 15s, NAS DUAS versões
// geradas. Bloco que funciona numa e falha na outra fica de fora: recurso
// que entrega metade das vezes gera mais contestação do que valor.
//
// Medições de 2026-09-05 (segundos de trecho instrumental, por versão):
//   Rock       silêncio normal 8s   → Solo de Guitarra 33/27 · Riff 21/39 · Final Instrumental 47/38
//   Pagode     silêncio normal 6s   → Solo de Cavaquinho 25/22
//   Sertanejo  silêncio normal 11s  → Solo de Viola 22/43
//   MPB        silêncio normal 6s   → Solo de Piano 29/30 · Violão Solo 17/25 · Intro Instrumental 33/29
//   Gospel     silêncio normal 4s   → Solo de Órgão 29/22 · Solo de Violino 40/22
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
//   Build, Quebra Instrumental (Eletrônica) — o CONTROLE do gênero já tem
//                          31s de instrumental natural, então este método
//                          não consegue julgar. Eletrônica exige outra
//                          medição; não é "reprovado", é "não sei".
//
// Pop, Reggae e Eletrônica seguem sem bloco aprovado. Aparecer sem opção é
// melhor que oferecer algo que não acontece.

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

export function temBloco(letra: string, tag: string): boolean {
  return new RegExp(`^\\[${tag}\\]$`, "mi").test(letra)
}
