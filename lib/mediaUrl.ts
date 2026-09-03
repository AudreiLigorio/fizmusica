import type { createServerClient } from "@/lib/supabase"

type DB = ReturnType<typeof createServerClient>

// Assinatura de URL para QUALQUER bucket fechado.
//
// Existe porque a mesma correção precisou ser feita quatro vezes em telas
// diferentes: fechar um bucket quebra todo mundo que guardava a URL pública
// do arquivo, e cada tela estava resolvendo isso por conta própria — ou não
// resolvendo. `lib/audioUrl.ts` continua sendo a porta do bucket `songs`
// (tem regra própria de validade); isto aqui serve os demais, hoje o
// `order-photos` do admin.
//
// Buckets fechados em 2026-09: songs, order-photos, avatars.
// Públicos: covers, content-media, product-images.

export const VALIDADE_SEGUNDOS = 30 * 60

// O banco guarda a URL pública inteira (decisão antiga, de quando os buckets
// eram públicos). Para assinar é preciso o CAMINHO dentro do bucket, extraído
// da própria URL — evita migração e backfill de centenas de linhas por um
// dado que já está ali.
export function caminhoNoBucket(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null
  const m = url.match(new RegExp(`/storage/v1/object/(?:public|sign)/${bucket}/(.+?)(?:\\?|$)`))
  return m ? decodeURIComponent(m[1]) : null
}

// Assina em LOTE: uma chamada só para a tela inteira. A lista de fotos de um
// pedido ou a fila de produção do admin fariam dezenas de idas ao Supabase se
// fossem uma a uma.
//
// Devolve {urlOriginal -> urlAssinada}. Quem não conseguir assinar fica de
// fora do mapa e a tela decide: hoje todas caem no link antigo, que mostra
// imagem quebrada — melhor que derrubar a página inteira.
export async function urlsAssinadas(
  supabase: DB,
  bucket: string,
  urls: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  const pares = urls
    .filter((u): u is string => !!u)
    .map((u) => ({ url: u, caminho: caminhoNoBucket(u, bucket) }))
    .filter((p): p is { url: string; caminho: string } => !!p.caminho)

  if (pares.length === 0) return mapa

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(pares.map((p) => p.caminho), VALIDADE_SEGUNDOS)

  if (error) {
    console.error(`[mediaUrl] falha ao assinar em lote (${bucket})`, error.message)
    return mapa
  }

  // A resposta volta na MESMA ordem da entrada — o índice religa cada
  // assinatura à URL original.
  data?.forEach((item, i) => {
    if (item.signedUrl && pares[i]) mapa.set(pares[i].url, item.signedUrl)
  })
  return mapa
}

// Açúcar para uma URL só.
export async function urlAssinada(
  supabase: DB,
  bucket: string,
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null
  const mapa = await urlsAssinadas(supabase, bucket, [url])
  return mapa.get(url) ?? null
}

export const BUCKET_FOTOS = "order-photos"

// Buckets fechados hoje. Ver o comentário do topo.
export const BUCKETS_FECHADOS = ["songs", "order-photos", "avatars"] as const

// Prepara uma URL guardada no banco para ser BAIXADA por código nosso
// (worker de vídeo, verificações do servidor). Se ela aponta pra bucket
// fechado, assina; se é de bucket público, devolve como está.
//
// Existe por causa do pipeline de vídeo: `video_jobs.song_url` pode receber a
// música de um pedido, que mora no bucket privado `songs`. Um `fetch` direto
// passou a devolver 400, e a montagem falhava com "faltam ingredientes no
// storage" — mensagem que apontava pro worker antigo e mandava investigar o
// lugar errado.
//
// A alternativa seria copiar a música pro `content-media`, que é público —
// mas isso reabriria justamente o buraco de download que o fechamento do
// bucket veio tapar. Assinar na hora de baixar mantém o arquivo privado.
export async function urlParaBaixar(
  supabase: DB,
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null
  for (const bucket of BUCKETS_FECHADOS) {
    if (caminhoNoBucket(url, bucket)) return (await urlAssinada(supabase, bucket, url)) ?? url
  }
  return url
}
