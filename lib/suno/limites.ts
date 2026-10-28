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
