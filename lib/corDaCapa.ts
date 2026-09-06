// Cor dominante da capa, lida no navegador.
//
// Serve pra tirar o player do preto chapado: hoje o degradê da tela termina
// em #0b0812 a partir de 42% da altura, e o sheet vai até rgba(10,9,18,.985)
// — praticamente a mesma cor do fundo. O resultado é uma tela apagada em que
// a superfície não se separa do fundo do site ("confundi com o preto do
// site" — Audrei, 2026-09-06).
//
// Dá pra ler os pixels porque TODAS as capas publicadas vivem num host só e
// ele responde `access-control-allow-origin: *` (conferido). Sem isso o
// canvas seria contaminado e `getImageData` lançaria — e o caminho teria de
// ser guardar a cor no banco na hora da produção.
//
// A cor entra só como MATIZ. O brilho e o teto de saturação são nossos, pra
// que uma capa amarela clara não vire fundo claro com texto branco em cima.

export type CorDaCapa = { h: number; s: number }

// Capa cinza/preta existe no catálogo. Abaixo deste peso não há matiz de
// verdade pra extrair, e insistir produziria uma cor aleatória de ruído —
// melhor devolver null e deixar a tela cair no gradiente da marca.
const PESO_MINIMO = 6

function rgbParaHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: h * 60, s, l }
}

const cache = new Map<string, CorDaCapa | null>()

export function extrairCorDaCapa(url: string): Promise<CorDaCapa | null> {
  const guardado = cache.get(url)
  if (guardado !== undefined) return Promise.resolve(guardado)

  return new Promise((resolve) => {
    const img = new Image()
    // Obrigatório: sem isto o canvas fica contaminado mesmo com o CORS certo.
    img.crossOrigin = "anonymous"
    img.onerror = () => { cache.set(url, null); resolve(null) }
    img.onload = () => {
      try {
        // 24x24 basta: queremos a cor dominante, não detalhe. Menos pixels
        // é menos trabalho na thread principal enquanto a música toca.
        const N = 24
        const cv = document.createElement("canvas")
        cv.width = N; cv.height = N
        const ctx = cv.getContext("2d", { willReadFrequently: true })
        if (!ctx) { cache.set(url, null); return resolve(null) }
        ctx.drawImage(img, 0, 0, N, N)
        const { data } = ctx.getImageData(0, 0, N, N)

        // Histograma de matiz em fatias de 20°. Cada pixel pesa pela
        // saturação e pela distância do preto e do branco: pixel quase preto
        // tem matiz, mas é matiz que ninguém enxerga, e é justamente o que
        // sobra numa capa escura — sem esse peso, a cor sairia de sombra.
        const N_FATIAS = 18
        const peso = new Array(N_FATIAS).fill(0)
        const somaX = new Array(N_FATIAS).fill(0)
        const somaY = new Array(N_FATIAS).fill(0)
        const somaS = new Array(N_FATIAS).fill(0)

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue
          const { h, s, l } = rgbParaHsl(data[i], data[i + 1], data[i + 2])
          if (s < 0.15 || l < 0.12 || l > 0.92) continue
          const p = s * (1 - Math.abs(l - 0.5) * 2 * 0.6)
          const f = Math.min(N_FATIAS - 1, Math.floor(h / (360 / N_FATIAS)))
          peso[f] += p
          // Média de ângulo por vetor: a média aritmética erra na volta do
          // círculo (350° e 10° dariam 180°, o oposto da cor real).
          const rad = (h * Math.PI) / 180
          somaX[f] += Math.cos(rad) * p
          somaY[f] += Math.sin(rad) * p
          somaS[f] += s * p
        }

        let melhor = 0
        for (let f = 1; f < N_FATIAS; f++) if (peso[f] > peso[melhor]) melhor = f
        if (peso[melhor] < PESO_MINIMO) { cache.set(url, null); return resolve(null) }

        let h = (Math.atan2(somaY[melhor], somaX[melhor]) * 180) / Math.PI
        if (h < 0) h += 360
        const cor = { h, s: somaS[melhor] / peso[melhor] }
        cache.set(url, cor)
        resolve(cor)
      } catch {
        // Canvas contaminado (host sem CORS) ou navegador antigo: sem cor, e
        // a tela segue no gradiente da marca.
        cache.set(url, null)
        resolve(null)
      }
    }
    img.src = url
  })
}

// O brilho é SEMPRE nosso: a capa dá o matiz, nós damos o valor. É o que
// garante que o texto branco continue legível qualquer que seja a capa.
export function tom(cor: CorDaCapa | null, luz: number, sMax = 0.40): string | null {
  if (!cor) return null
  const s = Math.min(cor.s, sMax)
  return `hsl(${cor.h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(luz * 100).toFixed(1)}%)`
}
