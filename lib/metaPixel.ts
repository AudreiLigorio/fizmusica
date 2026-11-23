"use client"

// Meta Pixel, lado do navegador.
//
// Existe para o Instagram otimizar o anúncio por quem COMEÇA e COMPRA, não por
// quem clica: sem ele a campanha só sabia contar clique, e entregava o anúncio
// a quem clica fácil e vai embora (21/11/2026: 261 visitas pagas, 84% saíram em
// menos de 1 minuto, zero pedidos).
//
// Desligado enquanto NEXT_PUBLIC_META_PIXEL_ID não existir: nenhum script da
// Meta carrega e `pixel()` não faz nada.
//
// Sem correspondência avançada (e-mail, telefone, nome): nenhum dado pessoal
// vai para a Meta, só o nome do evento e, na compra, valor e id do pedido.
// A Política de Cookies e a de Privacidade descrevem exatamente isso; mandar
// mais exige rever as duas.

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? ""

type Fbq = (...args: unknown[]) => void
type Pendente = unknown[]

declare global {
  interface Window {
    fbq?: Fbq
    __fbqPendentes?: Pendente[]
  }
}

/**
 * Envia um evento ao Pixel. Se o script da Meta ainda não carregou (ele entra
 * depois da hidratação, para não atrasar a primeira tela), o evento fica numa
 * fila que o próprio script esvazia ao carregar — senão o PageView da primeira
 * página, que é justamente a que veio do anúncio, se perderia.
 */
export function pixel(...args: unknown[]) {
  if (!META_PIXEL_ID) return
  try {
    if (window.location.pathname.startsWith("/admin")) return
    if (typeof window.fbq === "function") window.fbq(...args)
    else (window.__fbqPendentes ??= []).push(args)
  } catch {
    /* rastreamento nunca atrapalha o site */
  }
}

// Eventos que só valem uma vez por aba: o wizard dispara `wizard_passo` a cada
// troca de passo, inclusive ao voltar, e o Instagram contaria a mesma pessoa
// "começando o pedido" cinco vezes.
const disparados = new Set<string>()

function umaVez(chave: string, ...args: unknown[]) {
  if (disparados.has(chave)) return
  disparados.add(chave)
  pixel(...args)
}

/**
 * Traduz o evento do nosso funil (`track`) para o evento padrão da Meta.
 * Só os passos que importam para otimizar anúncio — o resto não sai daqui.
 *
 *   pageview                → PageView
 *   wizard_passo (≥ passo 2) → ViewContent  (escolheu a ocasião: começou de verdade)
 *   previa_letra "revelada"  → Lead          (contou a história e viu o refrão)
 *   checkout                 → InitiateCheckout
 *
 * A compra (Purchase) sai da página de sucesso, que é quem tem valor e id do
 * pedido — ver `pixelCompra`.
 */
export function pixelDoFunil(evento: string, detalhe?: string) {
  if (evento === "pageview") pixel("track", "PageView")
  else if (evento === "wizard_passo" && detalhe && detalhe !== "passo-1") umaVez("inicio", "track", "ViewContent")
  else if (evento === "previa_letra" && detalhe === "revelada") umaVez("lead", "track", "Lead")
  else if (evento === "checkout") umaVez("checkout", "track", "InitiateCheckout")
}

/**
 * Compra confirmada. O `eventID` é o id do pedido: a página de sucesso pode ser
 * recarregada ou reaberta pelo e-mail, e a Meta descarta o repetido com o mesmo
 * eventID. O guarda local cobre a mesma aba antes disso.
 */
export function pixelCompra(orderId: string, valor: number | null) {
  const chave = `fizmusica_px_compra_${orderId}`
  try {
    if (localStorage.getItem(chave)) return
    localStorage.setItem(chave, "1")
  } catch { /* sem storage: o eventID ainda deduplica do lado da Meta */ }
  const dados: Record<string, unknown> = { currency: "BRL" }
  if (valor != null && Number.isFinite(valor)) dados.value = valor
  pixel("track", "Purchase", dados, { eventID: `pedido-${orderId}` })
}
