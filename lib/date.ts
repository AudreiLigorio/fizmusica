// Formatação de datas no fuso de Brasília.
//
// As colunas de data no banco são `timestamp without time zone` e a sessão do
// Postgres roda em UTC, então os valores são gravados como wall-clock UTC. O
// PostgREST (Supabase) serializa essas colunas SEM designador de fuso
// (ex.: "2026-06-19T01:33:25.986"). Se passarmos essa string direto pro
// `new Date(...)`, o JS interpreta como horário LOCAL do runtime — e aí o
// `toLocaleString({ timeZone: "America/Sao_Paulo" })` não converte nada,
// exibindo o valor UTC cru (adiantado ~3h). A correção é forçar a leitura como
// UTC (anexando "Z") antes de formatar.

const BR_TZ = "America/Sao_Paulo"

/** Interpreta um timestamp do banco como UTC quando ele não traz fuso. */
export function parseDbDate(value: string | Date): Date {
  if (value instanceof Date) return value
  const s = String(value)
  // Já tem fuso explícito (Z ou ±HH:MM)? Confia no valor.
  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s)
  // Timestamp ingênuo → trata como UTC.
  return new Date(s.replace(" ", "T") + "Z")
}

export const fmtDateBR = (d: string | Date) =>
  parseDbDate(d).toLocaleDateString("pt-BR", { timeZone: BR_TZ })

export const fmtTimeBR = (d: string | Date) =>
  parseDbDate(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: BR_TZ })

export const fmtDateTimeBR = (d: string | Date) =>
  `${fmtDateBR(d)} ${fmtTimeBR(d)}`

/** Milissegundos do instante real — seguro para comparações/ordenção. */
export const dbTime = (d: string | Date) => parseDbDate(d).getTime()
