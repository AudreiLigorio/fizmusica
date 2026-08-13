// Converte os timestamps por palavra do Suno (alignedWords) no formato LRC
// [mm:ss.xx] que o player usa — descartando linhas de marcação de seção
// (Verso, Refrão, Ponte, etc.), que não são cantadas e desalinhariam a letra.

export type AlignedWord = { word: string; startS: number; endS: number; success?: boolean }

// Linha que é SÓ um rótulo de estrutura (PT/EN), com ou sem número/colchetes.
const SECTION_RE = /^\s*[\[(]?\s*(intro|outro|verso|verse|refr[ãa]o(\s+final)?|pr[ée]\s*-?\s*refr[ãa]o|pre\s*-?\s*chorus|chorus|ponte|bridge|hook|coro|solo|instrumental|final)(\s*\d+)?\s*[\]\)]?\s*$/i

function isSectionMarker(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/^\[.*\]$/.test(t)) return true       // qualquer [metatag]
  return SECTION_RE.test(t)
}

function stamp(sec: number): string {
  const mm = Math.floor(sec / 60).toString().padStart(2, "0")
  const ss = Math.floor(sec % 60).toString().padStart(2, "0")
  const cs = Math.floor((sec % 1) * 100).toString().padStart(2, "0")
  return `[${mm}:${ss}.${cs}]`
}

export function alignedWordsToLrc(words: AlignedWord[]): string {
  type Line = { text: string; start: number | null }
  const lines: Line[] = []
  let cur: Line = { text: "", start: null }

  for (const w of words) {
    const word = w.word ?? ""
    const parts = word.split("\n")
    // primeira parte continua a linha atual
    if (cur.start === null && parts[0].trim()) cur.start = w.startS
    cur.text += parts[0]
    // cada \n fecha a linha corrente e abre outra
    for (let i = 1; i < parts.length; i++) {
      lines.push(cur)
      cur = { text: parts[i], start: parts[i].trim() ? w.startS : null }
    }
  }
  if (cur.text.trim()) lines.push(cur)

  return lines
    .filter((l) => !isSectionMarker(l.text))
    .map((l) => `${stamp(l.start ?? 0)}${l.text.trim()}`)
    .join("\n")
}

/**
 * Remove os timestamps do LRC, devolvendo só a letra.
 *
 * Serve ao plano SEM letra sincronizada: a regra é esconder a sincronização,
 * não a letra. E é necessário na prática — a maioria das músicas publicadas
 * tem `lyricsLrc` preenchido e `lyrics` vazio (o LRC vem pronto do Suno via
 * alignedWords), então simplesmente não enviar o LRC deixaria o cliente sem
 * letra nenhuma.
 */
export function lrcToPlainLyrics(lrc: string): string {
  return lrc
    .split("\n")
    .map((l) => l.replace(/\[\d{2}:\d{2}(?:\.\d{2})?\]/g, "").trim())
    .filter(Boolean)
    .join("\n")
}
