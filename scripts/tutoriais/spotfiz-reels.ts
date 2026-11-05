// Peça de divulgação do SpotFiz — vertical, narrada, para Reels e TikTok.
//
// Não é tutorial: é convite. A narração é curta por cena de propósito, porque
// vídeo vertical disputa com o polegar e frase longa perde antes do terceiro
// segundo. A navegação acompanha o que a voz diz — quem assiste precisa ver
// na tela exatamente o que está ouvindo.
//
// Gravado contra a PRODUÇÃO, com a conta de demonstração. Só mostra o que já
// é público: músicas que os autores escolheram publicar no SpotFiz.
//
// NADA que altere estado. O aplauso é APONTADO, nunca dado — o medidor
// registra ao soltar, e um aplauso de verdade mexeria no ranking público de
// outra pessoa por causa de uma gravação.
//
//   npx tsx scripts/tutoriais/spotfiz-reels.ts

// Primeiro de todos: povoa process.env antes dos módulos que o leem.
import "./ambiente"
import { gravar, type Roteiro } from "./gravar"
import { linkDeEntrada } from "./sessao"
import { DIRECAO } from "@/lib/content/narracao"

const BASE = "https://www.fizmusica.com.br"
const CONTA = "fizmusicaoficial@gmail.com"
const SPOTFIZ = `${BASE}/minha-musica?aba=musicas`

/** Rola até um trecho de texto e deixa ele no meio da tela. */
async function irPara(p: any, texto: string) {
  const alvo = p.getByText(texto, { exact: false }).first()
  await alvo.scrollIntoViewIfNeeded({ timeout: 3000 })
  await p.waitForTimeout(500)
  return alvo
}

/**
 * Espera a tela chegar no estado que a narração promete.
 *
 * As primeiras gravações usavam espera fixa e saíam dessincronizadas: a voz
 * dizia "abra o player" e a tela mostrava a lista, porque o clique não tinha
 * surtido efeito e o roteiro seguia assim mesmo. Esperar pelo estado faz a
 * cena só avançar quando o que foi narrado está realmente na tela — e grita
 * no log quando não chega.
 */
async function esperarEstado(p: any, nome: string, cond: () => boolean, limite = 6000) {
  try {
    await p.waitForFunction(cond, null, { timeout: limite })
  } catch {
    console.error(`  ⚠️  a tela não chegou em "${nome}" — a cena vai sair fora de contexto`)
  }
}

/** Leva o ponteiro até o elemento — o cursor desenhado segue e dá vida. */
async function apontar(p: any, texto: string) {
  const alvo = await irPara(p, texto)
  await alvo.hover({ timeout: 3000 })
  await p.waitForTimeout(350)
}

const roteiro: Roteiro = {
  nome: "spotfiz-reels",
  base: BASE,
  vertical: true,
  inicio: SPOTFIZ,
  direcao: DIRECAO.entusiasmada,
  voz: "Kore",

  // Login fora do vídeo: as funções de quem tem conta (aplauso, desempenho,
  // carreira) precisam de sessão, e ninguém quer ver tela de login num convite.
  preparar: async (p) => {
    await p.goto(await linkDeEntrada(CONTA, `${BASE}/minha-musica`), { waitUntil: "networkidle" })
    await p.waitForTimeout(5000)

    // PRÉ-AQUECIMENTO. As duas últimas cenas navegam de página inteira, e
    // este site leva de 3 a 7 segundos por navegação — mais do que a frase
    // que as acompanha. O resultado mudava a cada gravação: às vezes a
    // Carreira aparecia, às vezes a voz falava dela sobre uma tela em branco.
    //
    // Visitar as telas aqui, antes de a gravação começar, deixa o navegador e
    // o Next com tudo em cache. A navegação de verdade vira quase instantânea.
    await p.goto(`${BASE}/minha-musica?aba=carreira`, { waitUntil: "networkidle" })
    await p.waitForTimeout(3000)
    await p.goto(SPOTFIZ, { waitUntil: "networkidle" })
    await p.waitForTimeout(5000)
  },

  cenas: [
    {
      narracao: "Esse é o SpotFiz. Músicas criadas por pessoas de verdade, pra momentos de verdade. E ouvir é de graça.",
      acao: async (p) => {
        await p.evaluate(() => window.scrollTo({ top: 0 }))
        await p.waitForTimeout(800)
      },
    },
    {
      narracao: "Comece pelas mais aplaudidas. Quem manda no ranking é quem ouve.",
      acao: async (p) => { await apontar(p, "MAIS APLAUDIDAS") },
    },
    {
      narracao: "Veja o que acabou de chegar, fresquinho.",
      acao: async (p) => { await apontar(p, "ACABARAM DE CHEGAR") },
    },
    {
      narracao: "E o Top 10 das mais ouvidas da plataforma inteira.",
      acao: async (p) => { await apontar(p, "MAIS OUVIDAS") },
    },
    {
      narracao: "Procurando algo pro seu momento? Filtre por ocasião: pedido de namoro, homenagem pet, chá revelação.",
      acao: async (p) => { await apontar(p, "POR OCASIÃO") },
    },
    {
      narracao: "Achou uma? Um toque e ela começa na hora.",
      acao: async (p) => {
        await irPara(p, "ACABARAM DE CHEGAR")
        await p.locator('[aria-label^="Tocar"]').first().click({ timeout: 3000 }).catch(() => {})
        await esperarEstado(p, "música tocando", () =>
          [...document.querySelectorAll("audio")].some((a) => !(a as HTMLAudioElement).paused))
        await p.waitForTimeout(700)
      },
    },
    {
      narracao: "Abra o player e acompanhe a música rolando, com a capa e o tempo correndo.",
      acao: async (p) => {
        // A barra do mini player abre o player cheio. O seletor é o TÍTULO da
        // faixa que a barra exibe — `text=` é motor próprio do Playwright e
        // não pode entrar numa lista CSS separada por vírgula (foi assim que
        // a primeira gravação saiu com o player fechado e sem o aplauso).
        await p.locator('text=Levanta a Mão').last().click({ timeout: 3000 }).catch(() => {})
        await esperarEstado(p, "player aberto", () =>
          !!document.querySelector('[aria-label="Fechar player"]'))
        await p.waitForTimeout(900)
      },
    },
    {
      narracao: "Emocionou? Aplauda. O medidor vai do silêncio até a plateia de pé — você decide o quanto.",
      acao: async (p) => {
        await esperarEstado(p, "medidor de aplauso visível", () =>
          /SEU APLAUSO/i.test(document.body.innerText), 4000)
        // Apontar, NUNCA soltar: o medidor registra o aplauso ao soltar, e um
        // aplauso de verdade mexeria no ranking público por causa de um vídeo.
        await p.getByText("SEU APLAUSO", { exact: false }).first()
          .hover({ timeout: 2500 }).catch(() => {})
        await p.waitForTimeout(1200)
      },
    },
    {
      narracao: "E a sua música também pode estar aqui, ouvida por gente do Brasil inteiro.",
      acao: async (p) => {
        await p.locator('[aria-label="Fechar player"]').first().click({ timeout: 2500 }).catch(() => {})
        await esperarEstado(p, "player fechado", () =>
          !document.querySelector('[aria-label="Fechar player"]'), 3000)
        await apontar(p, "Minhas músicas publicadas")
      },
    },
    {
      narracao: "Dá pra acompanhar as palmas que ela recebeu, quantas vezes foi ouvida e a posição dela no ranking.",
      acao: async (p) => { await irPara(p, "na Rede"); await p.waitForTimeout(700) },
    },
    {
      narracao: "Cada música que você cria rende discos, sobe o seu nível e aumenta o seu desconto na próxima.",
      acao: async (p) => {
        // `domcontentloaded`, nunca `networkidle`: medido, esta tela não
        // assenta a rede e o `networkidle` estourou 20s. Quem diz que chegou
        // é o CONTEÚDO, logo abaixo.
        await p.goto(`${BASE}/minha-musica?aba=carreira`, { waitUntil: "domcontentloaded" })
        // A Carreira monta o personagem e a barra de nível depois do HTML.
        // Com espera fixa, o vídeo mostrava a tela ainda em branco enquanto a
        // voz já falava de discos.
        await esperarEstado(p, "carreira montada", () =>
          /SEU NÍVEL/i.test(document.body.innerText), 7000)
        await p.waitForTimeout(700)
      },
    },
    {
      narracao: "SpotFiz: um acervo inteiro de histórias que viraram música, esperando você. Entra, escuta, aplaude. É de graça — e a próxima música pode ser a sua.",
      acao: async (p) => {
        await p.goto(SPOTFIZ, { waitUntil: "domcontentloaded" })
        await esperarEstado(p, "SpotFiz de volta", () =>
          /MAIS APLAUDIDAS/i.test(document.body.innerText), 6000)
        await p.evaluate(() => window.scrollTo({ top: 0 }))
        // Último quadro precisa ser uma tela parada e completa: é ele que
        // vira a capa do vídeo em muitas redes.
        await p.waitForTimeout(1000)
      },
    },
  ],
}

gravar(roteiro, "scripts/tutoriais/saida/spotfiz-reels.mp4").catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e)
  process.exit(1)
})
