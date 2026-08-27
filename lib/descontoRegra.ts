// Regra de qual desconto vale: cupom ou fidelidade. NÃO acumula — vale o maior.
//
// Mora num arquivo próprio, sem nenhum import, porque roda nos dois lados: o
// checkout usa pra MOSTRAR e o /api/payments/create usa pra COBRAR. Se cada
// lado tivesse a própria cópia da regra, um dia divergiriam e o cliente veria
// um preço e pagaria outro.
//
// Ficar em lib/fidelidade.ts não servia: aquele arquivo fala com o banco pelo
// service_role e não pode ser puxado pro navegador.
export function melhorDesconto(
  cupom: { desconto: number; codigo: string } | null,
  fidelidade: { desconto: number; nivelId: number } | null,
): { desconto: number; codigo: string | null; origem: "cupom" | "fidelidade" | null } {
  const c = cupom?.desconto ?? 0
  const f = fidelidade?.desconto ?? 0
  if (f > c && fidelidade) return { desconto: f, codigo: `CARREIRA-N${fidelidade.nivelId}`, origem: "fidelidade" }
  if (c > 0 && cupom) return { desconto: c, codigo: cupom.codigo, origem: "cupom" }
  return { desconto: 0, codigo: null, origem: null }
}
