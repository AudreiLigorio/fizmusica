// Calendário editorial brasileiro. É o que dá ao CMO noção de tempo — sem
// isso ele escolheria tema no vácuo, e sazonalidade é metade do jogo num
// negócio de presente.

export type DataComemorativa = {
  nome: string
  /** Resolve a data no ano informado (algumas são móveis). */
  data: (ano: number) => Date
  /** Quantos dias antes vale começar a falar do assunto. */
  antecedencia: number
  tema: string
}

// N-ésimo domingo de um mês (0=janeiro). Dia das Mães e dos Pais são móveis.
function nesimoDomingo(ano: number, mes: number, n: number): Date {
  const d = new Date(Date.UTC(ano, mes, 1))
  const ate1oDomingo = (7 - d.getUTCDay()) % 7
  return new Date(Date.UTC(ano, mes, 1 + ate1oDomingo + (n - 1) * 7))
}

export const DATAS: DataComemorativa[] = [
  { nome: "Dia das Mães",       data: (a) => nesimoDomingo(a, 4, 2),        antecedencia: 30, tema: "homenagem para a mãe" },
  { nome: "Dia dos Namorados",  data: (a) => new Date(Date.UTC(a, 5, 12)),  antecedencia: 21, tema: "presente para o amor da sua vida" },
  { nome: "Dia dos Pais",       data: (a) => nesimoDomingo(a, 7, 2),        antecedencia: 30, tema: "homenagem para o pai" },
  { nome: "Dia das Crianças",   data: (a) => new Date(Date.UTC(a, 9, 12)),  antecedencia: 21, tema: "homenagem para filho ou filha" },
  { nome: "Natal",              data: (a) => new Date(Date.UTC(a, 11, 25)), antecedencia: 40, tema: "presente de Natal para a família" },
  { nome: "Ano Novo",           data: (a) => new Date(Date.UTC(a, 11, 31)), antecedencia: 20, tema: "retrospectiva do ano em música" },
]

export type DataProxima = { nome: string; tema: string; diasRestantes: number }

// Datas dentro da janela de antecedência, da mais próxima pra mais distante.
// Considera também as do ano seguinte (fim de dezembro enxerga Dia das Mães).
export function datasProximas(hoje = new Date()): DataProxima[] {
  const dia = 24 * 60 * 60 * 1000
  const resultado: DataProxima[] = []

  for (const d of DATAS) {
    for (const ano of [hoje.getUTCFullYear(), hoje.getUTCFullYear() + 1]) {
      const alvo = d.data(ano)
      const diasRestantes = Math.ceil((alvo.getTime() - hoje.getTime()) / dia)
      if (diasRestantes >= 0 && diasRestantes <= d.antecedencia) {
        resultado.push({ nome: d.nome, tema: d.tema, diasRestantes })
      }
    }
  }

  return resultado.sort((a, b) => a.diasRestantes - b.diasRestantes)
}
