// Extrai só o refrão de uma letra gerada pelo compositor.
//
// Por que parsing e não uma instrução extra no prompt: pedir pro modelo marcar
// as seções na chamada da prévia faria a letra da prévia divergir da que o
// agente normalmente escreve — e a prévia é a letra de verdade, ela é
// reaproveitada como rascunho inicial depois do pagamento. Então a chamada é
// idêntica à de sempre e a separação acontece aqui.
//
// As regras abaixo saíram de um levantamento dos 49 rascunhos reais no banco,
// não do que o prompt pede. O prompt sugere a estrutura mas diz "sempre que
// possível", e na prática a IA varia bastante:
//
//   * três formatos de rótulo: `Refrão`, `[Refrão]` e `(Refrão)`
//   * às vezes em inglês: `[CHORUS]`, `[VERSE 1]`, `[PRE-CHORUS]`
//   * só ~40% dos rascunhos trazem um rótulo de refrão reconhecível
//   * e aparecem anotações de produção estilo Suno — `[Vocal Feminino]`,
//     `[heavy trap beats, 808s, gritty vocals]`, `[spoken, deep voice]` — que
//     não são letra e jamais podem vazar pro card da prévia.
//
// Daí a regra: linha inteiramente entre colchetes NUNCA é letra. Se o miolo é
// uma seção conhecida, delimita bloco; se não é, é anotação e some. Parênteses
// são mais ambíguos (podem ser vocal de apoio, "(oh oh oh)"), então só contam
// como rótulo quando o miolo é uma seção conhecida.

const SECAO_NOME =
  /^(intro|outro|final|coro|ponte|bridge|refr[ãa]o(\s+final)?|chorus|verso\s*\d*|verse\s*\d*|pr[ée][\s-]*refr[ãa]o|pre[\s-]*chorus)\s*:?\s*$/i

// Ancorados: "Pré-Refrão", "Refrão Final" e "PRE-CHORUS" não entram aqui.
const SO_REFRAO    = /^(refr[ãa]o|chorus)\s*:?\s*$/i
const REFRAO_FINAL = /^(refr[ãa]o\s+final|final\s+chorus)\s*:?\s*$/i

const MAX_LINHAS = 6

type Tipo = "vazia" | "anotacao" | "secao" | "letra"

type Linha = { tipo: Tipo; miolo: string; texto: string }

function classificar(bruta: string): Linha {
  const texto = bruta.trim()
  if (!texto) return { tipo: "vazia", miolo: "", texto }

  const colchete = texto.startsWith("[") && texto.endsWith("]")
  const parentese = texto.startsWith("(") && texto.endsWith(")")
  const miolo = colchete || parentese ? texto.slice(1, -1).trim() : texto

  if (SECAO_NOME.test(miolo)) return { tipo: "secao", miolo, texto }
  // Colchete que não é seção conhecida é direção de produção, não letra.
  if (colchete) return { tipo: "anotacao", miolo, texto }
  return { tipo: "letra", miolo, texto }
}

function blocoApos(linhas: Linha[], inicio: number): string[] {
  const out: string[] = []
  for (let i = inicio + 1; i < linhas.length; i++) {
    const l = linhas[i]
    if (l.tipo === "secao") break
    if (l.tipo === "anotacao") continue
    if (l.tipo === "vazia") {
      // Vazia antes do bloco começar é só respiro; depois de começar, marca o
      // fim do trecho útil (refrão longo com repetição não cabe no card).
      if (out.length === 0) continue
      break
    }
    out.push(l.texto)
    if (out.length >= MAX_LINHAS) break
  }
  return out
}

export function extrairRefrao(letra: string): string {
  const linhas = (letra ?? "").split("\n").map(classificar)

  const busca = (re: RegExp) =>
    linhas.findIndex((l) => l.tipo === "secao" && re.test(l.miolo))

  for (const re of [SO_REFRAO, REFRAO_FINAL]) {
    const i = busca(re)
    if (i !== -1) {
      const bloco = blocoApos(linhas, i)
      if (bloco.length) return bloco.join("\n")
    }
  }

  // Sem rótulo de refrão reconhecível (a maioria dos casos): usa as primeiras
  // linhas de letra de verdade, já sem rótulos nem anotações de produção. Não
  // é o refrão, mas é a música da pessoa — melhor que card vazio.
  return linhas
    .filter((l) => l.tipo === "letra")
    .slice(0, 4)
    .map((l) => l.texto)
    .join("\n")
}
