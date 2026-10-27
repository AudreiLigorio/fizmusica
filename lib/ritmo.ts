// Ritmos (estilos musicais) — lista oficial e unificação do acervo antigo.
//
// O `orders.musicalStyle` guarda o rótulo INTEIRO escolhido no wizard, emoji
// junto ("🎸 Rock"). Isso tem uma consequência que só apareceu quando os
// ritmos viraram mural: toda vez que o emoji da lista muda, os pedidos antigos
// continuam com o emoji velho e nasce um RITMO FANTASMA. Medido no acervo em
// 2026-10-26: "🎵 Forró" (5) convivia com "🪗 Forró" (2), "💃 Dance" com
// "🎙️ Dance", "🎉 Axé" com "☀️ Axé" e "🇧🇷 Samba" com "🥁 Samba" — 22 ritmos
// onde existem 20. Como pílula numa fileira que rola ninguém notava; como dois
// banners lado a lado com contagens diferentes, pareceria defeito.
//
// Por isso tudo que AGRUPA ou FILTRA ritmo passa por `nomeDoRitmo`, e tudo que
// EXIBE passa por `rotuloDoRitmo` (que devolve o emoji atual). O dado gravado
// não é tocado: a unificação é de leitura, então nenhum pedido antigo é
// reescrito e a regra também vale pro que ainda vai divergir.

// Lista oficial, usada pelo wizard (app/criar) E pelo catálogo. Viver nos dois
// lugares como literal solta foi justamente o que deixou os rótulos derivarem.
export const RITMOS = [
  "🎤 Sertanejo", "🎶 Pagode",    "💖 Pop",
  "🎵 Forró",     "🎸 Rock",      "🎹 MPB",
  "🙏 Gospel",    "🎧 Funk",      "🔥 Trap",
  "🎙️ Rap",       "💃 Dance",     "🎷 Jazz",
  "🎉 Axé",       "🤘 Metal",     "🎤 Hip-Hop",
  "⚡ Heavy Metal", "🤠 Country",  "🌿 Reggae",
  "🇰🇷 K-Pop",    "🌎 Internacional",
  "🌹 R&B",       "🇧🇷 Samba",    "🙌 Gospel Soul",
] as const

// Tira emoji, seletor de variação e junção ZWJ, sobrando só o nome.
// `\p{Emoji_Component}` cobre os indicadores regionais das bandeiras
// ("🇰🇷 K-Pop" → "K-Pop"), que não são `Extended_Pictographic`.
const SO_EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Component}️‍]/gu

/** Nome puro do ritmo, sem emoji — a chave de agrupamento e de filtro. */
export function nomeDoRitmo(bruto: string): string {
  return bruto.replace(SO_EMOJI, "").trim()
}

const EMOJI_ATUAL: Record<string, string> = Object.fromEntries(
  RITMOS.map((r) => {
    const nome = nomeDoRitmo(r)
    // Pelo índice do nome, não pela diferença de comprimento: emoji com
    // seletor de variação ("🎙️") e bandeira ("🇰🇷") ocupam 3 e 4 unidades,
    // e contar caracteres erraria o corte em cada um de um jeito diferente.
    return [nome, r.slice(0, r.indexOf(nome)).trim()]
  }),
)

/** Rótulo de exibição com o emoji ATUAL da lista oficial. */
export function rotuloDoRitmo(nome: string): string {
  // Ritmo que saiu da lista continua no acervo ("Pop Rock", 2 músicas): ganha
  // nota genérica em vez de ficar sem nada, senão ele é o único banner do
  // mural sem símbolo e parece item quebrado.
  return `${EMOJI_ATUAL[nome] ?? "🎵"} ${nome}`
}

/** Os ritmos de uma música, já unificados e sem vazios. */
export function ritmosDa(musicalStyle: string | null | undefined): string[] {
  return (musicalStyle ?? "")
    .split(",")
    .map((s) => nomeDoRitmo(s))
    .filter(Boolean)
}

// Cor de cada banner do mural. Fixa e escolhida à mão nos ritmos com acervo —
// cor derivada do nome por hash daria roxo pro Gospel e rosa-choque pro Metal,
// que é pior que arbitrário: é dissonante. Quem não está aqui cai na cor
// neutra da marca, e isso é esperado (são ritmos de 1 ou 2 músicas).
const COR: Record<string, string> = {
  "Rock":         "#b1291f",
  "Pop":          "#d6246e",
  "Gospel":       "#2f6f8f",
  "MPB":          "#1f7a5a",
  "Metal":        "#3e3a4d",
  "Sertanejo":    "#a9631e",
  "Pagode":       "#7a4a9e",
  "Hip-Hop":      "#1f4f7a",
  "Forró":        "#c2761a",
  "Samba":        "#8a2f3e",
  "Axé":          "#1f8a7a",
  "Reggae":       "#2e7d32",
  "K-Pop":        "#9c27b0",
  "Funk":         "#5e35b1",
  "Trap":         "#37474f",
  "Rap":          "#455a64",
  "R&B":          "#6a1b4d",
  "Jazz":         "#4e342e",
  "Dance":        "#0277bd",
  "Country":      "#8d6e3a",
  "Heavy Metal":  "#2d2d35",
  "Gospel Soul":  "#4a5d8f",
  "Internacional": "#546e7a",
  "Pop Rock":     "#c2415a",
}

const COR_PADRAO = "#5a4a6e"

export function corDoRitmo(nome: string): string {
  return COR[nome] ?? COR_PADRAO
}
