import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

async function getUserFromAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

// Catálogo público (dentro da área logada) — só pedido entregue, com
// autorização de divulgação e com capa gerada pelo Suno. NUNCA lê
// order_photos (fotos do cliente) — só sunoTracks, então não tem como
// vazar foto real por engano aqui. Nome do homenageado nunca sai daqui, de
// propósito (é dado de terceiro que não deu consentimento).
//
// Apelido do autor: só sai daqui quando o dono do pedido ligou
// profiles.mostrar_apelido (opt-in separado — publication_consent autoriza
// publicar a música, não expor identidade). Ver migração 052.
//
// Título: usa o real só quando `musicNameConfirmed` — a flag de "liberado pra
// aparecer publicamente", que se ganha de duas formas: (1) o cliente confirmou
// no passo de aprovar a letra, com sugestão que o prompt proíbe de ter nome
// próprio; (2) auditamos e liberamos na mão (backfill de 2026-08-26, 55
// pedidos legados). Sem a flag, cai pro derivado da ocasião — o
// `sunoTracks[].title` costuma ser o nome do homenageado ("Lucas", "Deus") e
// até o musicName antigo da IA já saiu com nome tirado da letra ("A Doce
// Espera de Beatriz", corrigido no backfill).
// Visitante SEM conta também acessa — a Rede é área de descoberta. Mas a
// resposta anônima é cortada, e cada corte tem motivo:
//
// - `slug`: NINGUÉM recebe aqui — nem logado. Ele é a chave de /m/{slug},
//   página que MOSTRA AS FOTOS do cliente: medido em 2026-09-04, abrir uma
//   dessas páginas sem conta nenhuma serviu 26 fotos, e a foto em si abriu
//   com 200. Antes o corte era só pro anônimo, mas o cadastro é aberto:
//   bastava criar conta, ler o slug na resposta desta rota e chegar nas
//   fotos de 60 pedidos (230 fotos). O termo autoriza divulgar "a música e
//   a letra", não as fotos.
//
//   O link /m/{slug} continua exatamente como era e MOSTRA as fotos: ele é
//   o que o PRÓPRIO cliente compartilha, único e conhecido só por ele, e o
//   termo diz que essa divulgação é controlada por ele (decisão do Audrei,
//   2026-09-04). O que não pode é a Rede distribuir esse link.
//
//   Nada no cliente consumia este campo — conferido antes de remover.
// - `authorApelido`: o termo exclui "qualquer exposição que identifique o
//   Cliente (autor do pedido)". Decisão do Audrei: apelido fora da área
//   pública.
// - `favorited`: não existe sem conta.
// ── Catálogo base (compartilhado, cacheado em memória) ───────────────────
//
// Medido em produção antes desta mudança: a rota era `force-dynamic` sem
// cache nenhum, então CADA visitante que abria a aba Músicas disparava 4
// consultas e a montagem da lista inteira. Com a Rede aberta ao visitante
// (sem login), isso virou carga de qualquer pessoa da internet.
//
// O que é IGUAL pra todo mundo fica aqui e é reaproveitado; o que é do
// cliente (favorito, slug, apelido próprio) é aplicado depois, e é barato.
//
// Cache por instância do servidor (Vercel roda várias) — não é um cache
// global perfeito, e não precisa ser: o objetivo é parar de refazer o mesmo
// trabalho a cada visita, não garantir consistência absoluta. 60s é bem menor
// que o intervalo real entre entregas de música nova.
type ItemBase = {
  orderId: string
  slug: string
  ownerId: string | null
  musicName: string | null
  musicNameConfirmed: boolean
  occasion: string
  musicalStyle: string | null
  imageUrl: string | null
  audioUrl: string
  // Letra NÃO entra no cache: além de não ir pra listagem, guardá-la em
  // memória em todo servidor multiplicaria o consumo por instância sem
  // ninguém usar.
  // Apelido separado em dois: o público (respeita mostrar_apelido) e o cru,
  // que SÓ pode ser usado quando quem pede é o próprio dono do pedido.
  apelidoPublico: string | null
  apelidoProprio: string | null
  // Reproduções (migração 057). `plays` é o total de sempre — é o número que
  // aparece no cartão. `playsRecentes` é a janela de 30 dias, usada só pelo
  // Top 10: ranking por total de sempre congela nos primeiros publicados
  // conforme o catálogo cresce, e deixa de refletir o que as pessoas estão
  // ouvindo AGORA.
  plays: number
  playsRecentes: number
  createdAt: string
}

const TTL_MS = 60_000
let cache: { em: number; itens: ItemBase[] } | null = null

// ── Crescimento do catálogo ───────────────────────────────────────────────
//
// O PostgREST desta instância corta em 1000 linhas SEM avisar: `site_events`
// tem 28.592 e uma consulta sem `.limit()` devolve exatamente 1000, sem erro
// (medido em 2026-09-02). Toda consulta daqui cresce junto com o catálogo,
// então na música 1001 a Rede simplesmente pararia de mostrar as novas — e
// nada no log denunciaria.
const PAGINA_POSTGREST = 1000

// Uma tabela inteira, em páginas. Para quando o lote vier menor que a página
// (não existe próxima), então gasta uma consulta a mais só quando o total é
// múltiplo exato de 1000.
async function todasAsLinhas<T>(
  buscarFaixa: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ linhas: T[]; erro?: string }> {
  const linhas: T[] = []
  for (let de = 0; ; de += PAGINA_POSTGREST) {
    const { data, error } = await buscarFaixa(de, de + PAGINA_POSTGREST - 1)
    if (error) return { linhas, erro: error.message }
    const lote = data ?? []
    linhas.push(...lote)
    if (lote.length < PAGINA_POSTGREST) return { linhas }
  }
}

// `.in(...)` com muitos ids tem um segundo teto, diferente: o filtro viaja na
// URL, que estoura bem antes das 1000 linhas. Por isso os ids vão em lotes
// menores, e os lotes em paralelo.
const LOTE_IDS = 200

async function porLotesDeIds<T>(
  ids: string[],
  buscar: (lote: string[]) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const lotes: string[][] = []
  for (let i = 0; i < ids.length; i += LOTE_IDS) lotes.push(ids.slice(i, i + LOTE_IDS))
  const respostas = await Promise.all(lotes.map((l) => buscar(l)))
  return respostas.flatMap((r) => r.data ?? [])
}

async function catalogoBase(): Promise<{ itens: ItemBase[]; erro?: string }> {
  if (cache && Date.now() - cache.em < TTL_MS) return { itens: cache.itens }

  const supabase = createServerClient()
  type OrderRow = { id: string; context: string | null; subcategory: string; musicalStyle: string | null; sunoTracks: unknown; createdAt: string; userId: string | null }
  const { linhas: orders, erro: error } = await todasAsLinhas<OrderRow>((de, ate) =>
    supabase
      .from("orders")
      // Sem join com products: ele só existia pra decidir se a letra vinha
      // sincronizada, e a letra saiu daqui (vai por /api/catalog/letra, que
      // aplica a mesma trava). Uma tabela a menos na consulta mais cara da tela.
      .select("id, context, subcategory, musicalStyle, sunoTracks, createdAt, userId")
      .eq("publication_consent", true)
      .eq("status", "DELIVERED")
      // Ordem estável: sem ORDER BY o Postgres não garante a mesma sequência
      // entre páginas, e uma linha podia vir duas vezes ou nenhuma.
      .order("createdAt", { ascending: true })
      .order("id", { ascending: true })
      .range(de, ate),
  )

  if (error) return { itens: [], erro: error }

  // Apelido do autor: opt-in separado do publication_consent (que só cobre a
  // música) — mostrar_apelido default false, então maioria dos pedidos não
  // tem dono identificável (userId nulo, checkout sem conta) nem apelido
  // preenchido, e isso é o esperado, não um bug.
  const ownerIds = [...new Set((orders ?? []).map((o) => o.userId).filter(Boolean))] as string[]
  type PerfilRow = { user_id: string; apelido: string | null; mostrar_apelido: boolean | null }
  const perfis = await porLotesDeIds<PerfilRow>(ownerIds, (lote) =>
    supabase.from("profiles").select("user_id, apelido, mostrar_apelido").in("user_id", lote),
  )
  const apelidoPublico: Record<string, string> = {}
  const apelidoProprio: Record<string, string> = {}
  for (const p of perfis ?? []) {
    const nome = p.apelido?.trim()
    if (!nome) continue
    apelidoProprio[p.user_id as string] = nome
    if (p.mostrar_apelido) apelidoPublico[p.user_id as string] = nome
  }

  // Contagem de reproduções: uma chamada agregada pro banco inteiro, não uma
  // consulta por música. Entra no mesmo cache de 60s do catálogo, então o
  // ranking acompanha a realidade com no máximo um minuto de atraso.
  //
  // Tolera a migração 057 ainda não ter rodado: sem a função, tudo fica em
  // zero e a Rede segue funcionando — o Top 10 é que não aparece.
  type PlayRow = { orderId: string; total: number; recentes: number }
  const { data: contagens, error: erroPlays } = await supabase.rpc("contagem_plays")
  if (erroPlays) console.warn("[catalog] contagem_plays indisponível:", erroPlays.message)
  const playsPorPedido: Record<string, { total: number; recentes: number }> = {}
  for (const c of (contagens as PlayRow[] | null) ?? []) {
    playsPorPedido[c.orderId] = { total: Number(c.total) || 0, recentes: Number(c.recentes) || 0 }
  }

  const ids = (orders ?? []).map((o) => o.id)
  type MusicRow = { orderId: string; slug: string | null; mp3Url: string | null; musicName: string | null; musicNameConfirmed: boolean | null }
  const gm = await porLotesDeIds<MusicRow>(ids, (lote) =>
    supabase.from("generated_music").select("orderId, slug, mp3Url, musicName, musicNameConfirmed").in("orderId", lote),
  )
  const musicByOrder: Record<string, { slug: string | null; mp3Url: string | null; musicName: string | null; musicNameConfirmed: boolean }> = {}
  for (const g of gm ?? []) musicByOrder[g.orderId as string] = {
    slug: g.slug ?? null,
    mp3Url: g.mp3Url ?? null,
    musicName: g.musicName ?? null,
    musicNameConfirmed: !!g.musicNameConfirmed,
  }

  type Track = { audioUrl: string; imageUrl: string | null; title: string | null }
  const itens = (orders ?? [])
    .map((o): ItemBase | null => {
      const music = musicByOrder[o.id]
      const tracks = (o.sunoTracks as Track[] | null) ?? []
      const principal = tracks.find((t) => t.audioUrl === music?.mp3Url) ?? tracks[0]
      // Entrega antiga (manual) não tem sunoTracks: o áudio está só no mp3Url
      // e não existe capa. Entra assim mesmo — a tela cai no gradiente da
      // marca quando imageUrl é nulo. Sem áudio nenhum é que não entra.
      const audioUrl = principal?.audioUrl ?? music?.mp3Url ?? null
      if (!music?.slug || !audioUrl) return null
      const dono = (o.userId as string | null) ?? null
      return {
        orderId: o.id,
        slug: music.slug,
        ownerId: dono,
        musicName: music.musicName,
        musicNameConfirmed: music.musicNameConfirmed,
        occasion: o.subcategory,
        musicalStyle: o.musicalStyle ?? null,
        imageUrl: principal?.imageUrl ?? null,
        audioUrl,
        apelidoPublico: dono ? apelidoPublico[dono] ?? null : null,
        apelidoProprio: dono ? apelidoProprio[dono] ?? null : null,
        plays: playsPorPedido[o.id]?.total ?? 0,
        playsRecentes: playsPorPedido[o.id]?.recentes ?? 0,
        createdAt: o.createdAt as string,
      }
    })
    .filter((x): x is ItemBase => x !== null)

  cache = { em: Date.now(), itens }
  return { itens }
}

// Embaralhamento ESTÁVEL por semente.
//
// A ordem aleatória a cada visita é intencional (por data soterrava os
// pedidos antigos conforme o catálogo crescia). Mas com paginação, sortear
// de novo a cada requisição faria a página 2 repetir ou pular músicas da
// página 1. A semente vem do cliente, gerada uma vez por visita: dentro da
// mesma visita a ordem é sempre a mesma; numa visita nova, muda.
function embaralharComSemente<T>(arr: T[], semente: number): T[] {
  const a = [...arr]
  let s = semente || 1
  for (let i = a.length - 1; i > 0; i--) {
    // PRNG simples e determinístico (xorshift) — não precisa ser bom
    // aleatório, precisa ser REPETÍVEL pra mesma semente.
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0
    const j = Math.abs(s) % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function normalizarTexto(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

// Mesma regra do lib/busca.ts do cliente: cada palavra digitada precisa
// aparecer em algum campo. Duplicada aqui porque a busca passou a acontecer
// no SERVIDOR — o cliente não tem mais o catálogo inteiro pra filtrar.
function combinaBusca(termo: string, campos: (string | null)[]): boolean {
  const t = normalizarTexto(termo)
  if (!t) return true
  const alvo = campos.filter(Boolean).map((c) => normalizarTexto(c as string)).join(" ")
  return t.split(/\s+/).every((parte) => alvo.includes(parte))
}

const LIMITE_PADRAO = 40
const LIMITE_MAX = 200

export async function GET(req: NextRequest) {
  const user = await getUserFromAuth(req)
  const publico = !user

  const { itens: base, erro } = await catalogoBase()
  if (erro) return NextResponse.json({ error: erro }, { status: 500 })

  const supabase = createServerClient()
  const { data: favs } = user
    ? await supabase.from("catalog_favorites").select("order_id").eq("user_id", user.id)
    : { data: [] }
  const favoriteSet = new Set((favs ?? []).map((f) => f.order_id))

  // A Rede é o catálogo de OUTRAS pessoas — é o que o próprio subtítulo da
  // tela promete ("Escute músicas publicadas por outros usuários"). As do
  // cliente vêm da biblioteca dele, não daqui.
  //
  // Sem isso a música dele aparecia nas duas listas e a contagem somava duas
  // vezes: a tela dizia "27 encontradas" e mostrava 16. Deduplicar só na tela
  // não resolve com paginação — o cliente não vê o catálogo inteiro pra saber
  // o que é repetido.
  const deOutros = user ? base.filter((b) => b.ownerId !== user.id) : base

  // Personalização em cima da base compartilhada. Tudo o que depende de QUEM
  // está pedindo mora aqui — nunca no cache.
  const items = deOutros.map((b) => {
    const proprio = !!b.ownerId && b.ownerId === user?.id
    return {
      orderId: b.orderId,
      // Sem slug pra ninguém — ver o comentário no topo.
      // Nome real quando o cliente confirmou — ou sempre, se a música é dele
      // (a trava do confirmado existe pra não expor título de terceiro).
      title: b.musicName?.trim() && (b.musicNameConfirmed || proprio)
        ? b.musicName.trim()
        : `Uma canção de ${b.occasion}`,
      occasion: b.occasion,
      musicalStyle: b.musicalStyle,
      imageUrl: b.imageUrl,
      // NUNCA o link do arquivo: /api/audio verifica quem pode ouvir e
      // redireciona pra uma URL assinada que expira. Antes daqui saía o
      // endereço permanente do MP3 — inclusive pro visitante anônimo — e
      // dava pra baixar a música com dois comandos.
      audioUrl: `/api/audio?o=${b.orderId}`,
      // Sem letra aqui de propósito: eram 76% do payload (medido — 114 KB de
      // 150 KB para 68 músicas) e a listagem não usa letra nenhuma. O player
      // busca em /api/catalog/letra quando vai tocar.
      // Apelido próprio só sai pro próprio dono; pros outros vale o opt-in.
      authorApelido: publico ? null : (proprio ? b.apelidoProprio : b.apelidoPublico),
      plays: b.plays,
      favorited: favoriteSet.has(b.orderId),
      createdAt: b.createdAt,
    }
  })

  // ── Busca e filtro agora acontecem AQUI ───────────────────────────────
  //
  // Antes o cliente recebia o catálogo inteiro e filtrava na tela. Com
  // paginação isso deixa de funcionar: não dá pra buscar no que não foi
  // carregado. A busca subiu pro servidor, que tem a lista completa em cache.
  const sp = req.nextUrl.searchParams
  const busca = sp.get("busca")?.trim() ?? ""
  const ocasiao = sp.get("ocasiao")?.trim() || null
  const estilo = sp.get("estilo")?.trim() || null

  const porBusca = busca
    ? items.filter((i) => combinaBusca(busca, [i.title, i.occasion, i.musicalStyle]))
    : items

  // ── Facetas ───────────────────────────────────────────────────────────
  //
  // As contagens das pílulas vêm do SERVIDOR agora. Com paginação o cliente
  // só tem uma página, então contar na tela diria "Rock · 12" quando o
  // catálogo tem 300 — a pílula prometeria um número e a lista entregaria
  // outro, erro que já aconteceu uma vez (ver 78faf4d).
  //
  // Contadas sobre o resultado da BUSCA, mas ANTES do filtro de
  // ocasião/estilo: senão clicar em "Rock" zeraria todas as outras pílulas e
  // não haveria como voltar.
  const ocasioes: Record<string, number> = {}
  const estilos: Record<string, number> = {}
  for (const i of porBusca) {
    ocasioes[i.occasion] = (ocasioes[i.occasion] ?? 0) + 1
    for (const e of (i.musicalStyle ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
      estilos[e] = (estilos[e] ?? 0) + 1
    }
  }

  const filtrados = porBusca.filter((i) => {
    if (ocasiao && i.occasion !== ocasiao) return false
    if (estilo && !(i.musicalStyle ?? "").split(",").map((x) => x.trim()).includes(estilo)) return false
    return true
  })

  // ── Ordem e página ────────────────────────────────────────────────────
  //
  // Favoritados sempre primeiro (pedido do Audrei: "se o cliente favoritar
  // tem que manter como as primeiras").
  const semente = Number(sp.get("semente")) || 1
  const ordenados = [
    ...embaralharComSemente(filtrados.filter((i) => i.favorited), semente),
    ...embaralharComSemente(filtrados.filter((i) => !i.favorited), semente),
  ]

  const limite = Math.min(LIMITE_MAX, Math.max(1, Number(sp.get("limite")) || LIMITE_PADRAO))
  const inicio = Math.max(0, Number(sp.get("desde")) || 0)
  const pagina = ordenados.slice(inicio, inicio + limite)

  // ── Top 10 mais ouvidas ───────────────────────────────────────────────
  //
  // Calculado sobre a Rede INTEIRA, não sobre a página nem sobre os filtros:
  // é um ranking, não um recorte do que está na tela. Por isso sai daqui e
  // não do `filtrados`.
  //
  // Ordena pela janela de 30 dias, com o total de sempre como desempate.
  // Ranking por total puro congelaria: quem publicou primeiro acumula pra
  // sempre e as músicas novas nunca alcançam, por mais que estejam bombando.
  // A janela é o que faz o "dinâmico conforme a realidade" ser verdade.
  //
  // Música com zero reprodução fica FORA — um Top 10 preenchido com zeros
  // seria uma lista arbitrária fingindo ser ranking. No começo ele vem com
  // menos de 10, ou vazio, e isso é honesto: ninguém ouviu ainda.
  const indicePorId = new Map(deOutros.map((b) => [b.orderId, b]))
  const top10 = items
    .filter((i) => (indicePorId.get(i.orderId)?.plays ?? 0) > 0)
    .sort((a, b) => {
      const A = indicePorId.get(a.orderId)
      const B = indicePorId.get(b.orderId)
      return (B?.playsRecentes ?? 0) - (A?.playsRecentes ?? 0)
          || (B?.plays ?? 0) - (A?.plays ?? 0)
    })
    .slice(0, 10)

  return NextResponse.json(
    {
      items: pagina,
      top10,
      total: ordenados.length,
      // Quantas músicas a busca encontrou ANTES do filtro de ocasião/estilo.
      //
      // É este o número da pílula "Todas": ele promete o que a pessoa vai
      // ver se limpar o filtro. Usar `total` ali estava errado — com um
      // filtro ativo ele já vinha reduzido, e a tela exibia "Todas · 5" ao
      // lado de "Já tenho a composição da Letra · 22". Uma pílula prometendo
      // MENOS que uma faceta individual, o que é impossível de entender.
      //
      // Mesma base das facetas (`porBusca`), então os números da barra
      // inteira passam a conversar entre si.
      totalDaBusca: porBusca.length,
      // `temMais` explícito em vez de deixar o cliente calcular: ele não
      // precisa saber como a página foi cortada pra decidir se pede mais.
      temMais: inicio + pagina.length < ordenados.length,
      facetas: {
        ocasioes: Object.entries(ocasioes).sort((a, b) => b[1] - a[1]),
        estilos: Object.entries(estilos).sort((a, b) => b[1] - a[1]),
      },
    },
    // Explícito: a resposta muda por usuário (favorito, slug, apelido
    // próprio). Sem isso, um CDN que cacheia por caminho poderia servir a
    // versão de um cliente logado pra um visitante anônimo — o que vazaria
    // slug (caminho pras fotos) e apelido, justo o que a Fase 2 fechou.
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
