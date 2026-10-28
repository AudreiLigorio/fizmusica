// Limites do fornecedor que o CLIENTE precisa respeitar.
//
// Vivem separados porque são usados em três camadas que não se conhecem: a
// rota que aprova a letra (servidor), o painel onde ele escreve (navegador) e
// a classificação da recusa (servidor). Repetir o número nos três é como ele
// envelhece errado.
//
// 5000 é o teto do Suno em "custom mode". Descoberto do jeito ruim, em
// produção: um pedido com 5400 caracteres foi aprovado sem aviso, a geração
// foi recusada no envio e o cliente ficou esperando uma música que nunca ia
// sair (#5C4FB68C, 28/10/2026).
export const LIMITE_LETRA = 5000

export type MedidaLetra = {
  /** O que o fornecedor conta: o campo inteiro. */
  total: number
  /** O que vai ser cantado — fora das marcações. */
  cantada: number
  /** O que está dentro de [colchetes]: estrutura e direção de produção. */
  instrucoes: number
}

// Separa a LETRA das INSTRUÇÕES, porque dizer só o total manda a pessoa pro
// lugar errado.
//
// Caso real que mostrou isso (#8DE81BD7, 28/10/2026): um cliente tentou a
// mesma música cinco vezes na mesma madrugada. A letra cantada foi SEMPRE a
// mesma, 2.728 caracteres — bem dentro do limite. O que crescia a cada
// tentativa era o briefing entre colchetes ("[Style: ... 80 BPM, minor key,
// VERY HEAVY DRUMS ...]"), até chegar a 3.460 caracteres e estourar o campo.
// Duas tentativas com briefing menor foram gravadas e entregues; três
// falharam.
//
// A mensagem que existia aqui dizia "tire cerca de 1.188 caracteres", e quem
// lê isso corta VERSOS — justamente a parte que caberia. Por isso a conta é
// separada: o excesso tem endereço.
export function medirLetra(texto: string): MedidaLetra {
  const total = texto.length
  let instrucoes = 0
  // Colchete sem fechamento não conta como marcação (o `\]` é obrigatório):
  // texto solto com um "[" perdido é letra, e seria pior inflar as instruções
  // e mandar a pessoa encurtar o que não existe.
  for (const m of texto.matchAll(/\[[^\]]*\]/g)) instrucoes += m[0].length
  return { total, cantada: total - instrucoes, instrucoes }
}

// O excesso cabe inteiro dentro das instruções? Então encurtar os colchetes
// resolve, e não faz sentido pedir pra mexer na letra. Se nem a letra cantada
// couber, aí o corte precisa alcançar os versos também.
export function excessoEstaNasInstrucoes(m: MedidaLetra): boolean {
  return m.total > LIMITE_LETRA && m.cantada <= LIMITE_LETRA
}
