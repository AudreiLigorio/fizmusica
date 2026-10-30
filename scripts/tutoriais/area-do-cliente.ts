// Tutorial piloto: a área do cliente depois da compra.
//
// Gravado contra a PRODUÇÃO de propósito — é o que o cliente vê. O Playwright
// grava só o conteúdo da página, sem barra de endereço, então nada de
// ambiente aparece no vídeo.
//
// Conta de demonstração: fizmusicaoficial@gmail.com. Nenhum dado de outro
// cliente aparece aqui dentro — a aba do SpotFiz mostra músicas publicadas,
// que já são públicas por decisão de quem publicou.
//
// REGRA DE SEGURANÇA destas cenas: nada que altere estado. Sem "Tirar da
// Rede", sem excluir, sem salvar. A gravação roda em produção e um clique
// errado mexeria na conta de verdade.
//
//   npx tsx scripts/tutoriais/area-do-cliente.ts

import { gravar, type Roteiro } from "./gravar"
import { linkDeEntrada } from "./sessao"

const BASE = "https://www.fizmusica.com.br"
const CONTA = "fizmusicaoficial@gmail.com"

/** Rola suave até um texto e deixa ele no meio da tela. */
async function mostrar(p: any, texto: string) {
  const alvo = p.getByText(texto, { exact: false }).first()
  await alvo.scrollIntoViewIfNeeded({ timeout: 8000 })
  await p.waitForTimeout(600)
  return alvo
}

/** Passa o mouse por cima — o ponteiro desenhado segue, e a tela ganha vida. */
async function apontar(p: any, texto: string) {
  const alvo = await mostrar(p, texto)
  await alvo.hover({ timeout: 8000 })
  await p.waitForTimeout(400)
}

const roteiro: Roteiro = {
  nome: "area-do-cliente",
  base: BASE,

  // Entra pela mesma porta do cliente (link por e-mail), antes de a gravação
  // valer: ninguém precisa ver a tela de login num tutorial sobre a área.
  preparar: async (p) => {
    const link = await linkDeEntrada(CONTA, `${BASE}/minha-musica`)
    await p.goto(link, { waitUntil: "domcontentloaded" })
    await p.waitForTimeout(5000)
  },

  cenas: [
    {
      narracao:
        "Depois que você compra sua música na Fiz Música, tudo o que acontece daqui pra frente fica em um lugar só: a sua área. Vamos dar uma volta por ela.",
      acao: async (p) => {
        await p.goto(`${BASE}/minha-musica?aba=pedidos`, { waitUntil: "domcontentloaded" })
        await p.waitForTimeout(2500)
      },
    },
    {
      narracao:
        "A primeira aba é Pedidos. Aqui você acompanha cada música que pediu, e o sistema avisa logo no topo se alguma coisa depende de você.",
      acao: async (p) => { await apontar(p, "Meus pedidos") },
    },
    {
      narracao:
        "As músicas que já ficaram prontas ficam agrupadas em Entregues. É só abrir pra ver todas elas.",
      acao: async (p) => { await apontar(p, "ENTREGUES") },
    },
    {
      narracao:
        "Cada música entregue mostra o título que você escolheu e a ocasião. Quando ela está publicada, aparece o selo Na Rede.",
      acao: async (p) => { await apontar(p, "NA REDE") },
    },
    {
      narracao:
        "Na aba SpotFiz você escuta o que outras pessoas publicaram. São histórias reais que viraram música, e qualquer uma delas pode ser ouvida por inteiro.",
      acao: async (p) => {
        await p.goto(`${BASE}/minha-musica?aba=musicas`, { waitUntil: "domcontentloaded" })
        await p.waitForTimeout(2500)
      },
    },
    {
      narracao:
        "Dá pra filtrar por ocasião: pedido de namoro, homenagem a um pet, chá revelação, composição autoral. Toque em qualquer uma pra ver só aquelas.",
      acao: async (p) => { await apontar(p, "POR OCASIÃO") },
    },
    {
      narracao:
        "E tem a lista das mais aplaudidas. O aplauso é como quem ouve demonstra que a música tocou de verdade.",
      acao: async (p) => { await apontar(p, "MAIS APLAUDIDAS") },
    },
    {
      narracao:
        "A última aba é a sua Carreira. Cada música que você cria rende discos, e os discos fazem o seu nível subir.",
      acao: async (p) => {
        await p.goto(`${BASE}/minha-musica?aba=carreira`, { waitUntil: "domcontentloaded" })
        await p.waitForTimeout(2500)
      },
    },
    {
      narracao:
        "Quanto mais alto o nível, maior o desconto na próxima música. E aqui você também acompanha o saldo do seu pacote e o seu link de indicação.",
      acao: async (p) => { await apontar(p, "SEU NÍVEL") },
    },
    {
      narracao:
        "É isso. Pedidos pra acompanhar, SpotFiz pra ouvir, Carreira pra crescer. Sua história, sua música.",
      acao: async (p) => {
        await mostrar(p, "Minha carreira").catch(() => {})
        await p.waitForTimeout(1200)
      },
    },
  ],
}

gravar(roteiro, "scripts/tutoriais/saida/area-do-cliente.mp4").catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e)
  process.exit(1)
})
