import type { createServerClient } from "@/lib/supabase"

type DB = ReturnType<typeof createServerClient>

export const BUCKET_SONGS = "songs"

// Quanto tempo a URL assinada vale. Curto de propósito: ela só precisa
// sobreviver ao tempo entre o navegador pedir e começar a tocar. Copiar e
// colar num chat deixa de funcionar em minutos.
//
// Não pode ser curto DEMAIS: o navegador refaz a requisição ao arrastar a
// barra de progresso (Range request), e uma música de 4 min pode ser ouvida
// aos poucos. 30 min cobre isso com folga.
export const VALIDADE_URL_SEGUNDOS = 30 * 60

// O banco guarda a URL pública inteira (decisão antiga, quando o bucket era
// público). Pra assinar preciso do CAMINHO dentro do bucket — extraído da
// própria URL em vez de gravar uma coluna nova, que exigiria migração e
// backfill de 70 músicas por um dado que já está ali.
export function caminhoNoBucket(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/songs\/(.+?)(?:\?|$)/)
  return m ? decodeURIComponent(m[1]) : null
}

// Cache das assinaturas, em memória.
//
// Fechar o bucket cobrou seu preço: cada play virou 2 consultas ao banco +
// 1 chamada de assinatura ao Supabase, ~300ms cada, em série — o Audrei
// sentiu como "delay" na Rede. Medido em 2026-09-02: 1,7-1,9s até o
// primeiro byte do MP3, contra o link direto de antes.
//
// A assinatura de um mesmo arquivo é sempre equivalente: mesmo caminho,
// mesma validade. Então não há motivo pra pedir outra a cada play — a mesma
// URL serve enquanto não estiver perto de vencer.
//
// Isto NÃO enfraquece a proteção: quem pode ouvir continua sendo decidido a
// cada requisição, no banco, sem cache. O que se reaproveita é só a
// assinatura de um arquivo que a requisição JÁ foi autorizada a ouvir.
//
// A margem existe porque a URL entregue agora ainda precisa durar a música
// inteira: guardamos por 20 min uma assinatura de 30, então a mais velha
// que alguém recebe ainda tem 10 min de vida — cobre uma faixa de 4 min com
// folga, inclusive arrastando a barra de progresso.
const VALIDADE_CACHE_MS = 20 * 60 * 1000
const cacheAssinaturas = new Map<string, { url: string; em: number }>()

// URL assinada e temporária para um arquivo do bucket songs.
//
// Existe porque o bucket era PÚBLICO e o endereço do MP3, permanente: bastava
// abrir o inspetor (ou ler a resposta de /api/catalog) pra baixar a música de
// qualquer cliente, sem conta. Auditado em 2026-08-28 — baixei 4,4 MB com
// dois comandos.
export async function urlAssinadaDoAudio(
  supabase: DB,
  urlPublicaOuCaminho: string | null | undefined,
): Promise<string | null> {
  const caminho = urlPublicaOuCaminho?.startsWith("http")
    ? caminhoNoBucket(urlPublicaOuCaminho)
    : (urlPublicaOuCaminho ?? null)
  if (!caminho) return null

  const guardada = cacheAssinaturas.get(caminho)
  if (guardada && Date.now() - guardada.em < VALIDADE_CACHE_MS) return guardada.url

  const { data, error } = await supabase.storage
    .from(BUCKET_SONGS)
    .createSignedUrl(caminho, VALIDADE_URL_SEGUNDOS)
  if (error) {
    console.error("[audioUrl] falha ao assinar", caminho, error.message)
    return null
  }
  const url = data?.signedUrl ?? null
  if (url) cacheAssinaturas.set(caminho, { url, em: Date.now() })
  return url
}

// Versão em LOTE. Existe por causa da fila de produção do admin: são ~70
// pedidos, cada um com até 2 versões — assinar uma a uma seriam ~140 idas
// ao Supabase antes da página renderizar. `createSignedUrls` resolve tudo
// numa chamada só.
//
// Devolve um mapa {urlOriginal -> urlAssinada}. Quem não conseguir assinar
// fica de fora do mapa: a tela decide o que fazer (hoje, cai no link antigo
// e o player mostra erro — melhor que a página inteira quebrar).
export async function urlsAssinadasDoAudio(
  supabase: DB,
  urlsPublicas: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  const pares = urlsPublicas
    .filter((u): u is string => !!u)
    .map((u) => ({ url: u, caminho: caminhoNoBucket(u) }))
    .filter((p): p is { url: string; caminho: string } => !!p.caminho)

  if (pares.length === 0) return mapa

  const { data, error } = await supabase.storage
    .from(BUCKET_SONGS)
    .createSignedUrls(pares.map((p) => p.caminho), VALIDADE_URL_SEGUNDOS)

  if (error) {
    console.error("[audioUrl] falha ao assinar em lote", error.message)
    return mapa
  }

  // A resposta volta na MESMA ordem da entrada, então o índice liga cada
  // assinatura de volta à URL original.
  data?.forEach((item, i) => {
    if (item.signedUrl && pares[i]) mapa.set(pares[i].url, item.signedUrl)
  })
  return mapa
}
