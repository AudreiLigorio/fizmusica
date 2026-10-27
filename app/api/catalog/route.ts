import { tituloNeutro, rotuloOcasiao } from "@/lib/tituloPublico"
import { dbTime } from "@/lib/date"
import { RITMOS, corDoRitmo, nomeDoRitmo, ritmosDa, rotuloDoRitmo } from "@/lib/ritmo"
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
  // Total acumulado de palmas — o número que aparece na música. A ordem do
  // "Em alta" é outra coisa (palmas por ouvinte na janela) e vem pronta do
  // banco.
  palmas: number
  createdAt: string
  // Quando a música foi PUBLICADA, que não é quando o pedido foi feito: a
  // mediana entre as duas é zero, mas 13 músicas do acervo levaram mais de 7
  // dias (a maior, 26). Ordenar "mais recentes" por `createdAt` já colocaria a
  // raia fora de ordem hoje.
  publishedAt: string | null
  // Chave de agrupamento por AUTOR, calculada aqui pra que o e-mail não entre
  // no cache nem chegue perto da resposta. Cai pro e-mail porque checkout sem
  // conta não tem userId, e pro id do pedido no último caso — aí cada pedido
  // conta como um autor, que é o certo: dois anônimos distintos não são a
  // mesma pessoa.
  autorKey: string
  // Revisão é pedido DUPLICADO do mesmo cliente (ver lib/revision.ts): entrar
  // na raia faria a mesma música voltar como novidade.
  isRevision: boolean
}

const TTL_MS = 60_000
let cache: { em: number; itens: ItemBase[]; emAlta: string[] } | null = null

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

async function catalogoBase(): Promise<{ itens: ItemBase[]; emAlta: string[]; erro?: string }> {
  if (cache && Date.now() - cache.em < TTL_MS) return { itens: cache.itens, emAlta: cache.emAlta }

  const supabase = createServerClient()
  type OrderRow = { id: string; context: string | null; subcategory: string; musicalStyle: string | null; sunoTracks: unknown; createdAt: string; userId: string | null; email: string | null; is_revision: boolean | null }
  const { linhas: orders, erro: error } = await todasAsLinhas<OrderRow>((de, ate) =>
    supabase
      .from("orders")
      // Sem join com products: ele só existia pra decidir se a letra vinha
      // sincronizada, e a letra saiu daqui (vai por /api/catalog/letra, que
      // aplica a mesma trava). Uma tabela a menos na consulta mais cara da tela.
      // `email` entra só pra virar `autorKey` abaixo e é DESCARTADO ali — ele
      // não existe no `ItemBase`, então não fica no cache nem sai na resposta.
      .select("id, context, subcategory, musicalStyle, sunoTracks, createdAt, userId, email, is_revision")
      .eq("publication_consent", true)
      .eq("status", "DELIVERED")
      // Tirada da Rede pelo admin após denúncia (migração 066).
      .eq("rede_oculta", false)
      // Ordem estável: sem ORDER BY o Postgres não garante a mesma sequência
      // entre páginas, e uma linha podia vir duas vezes ou nenhuma.
      .order("createdAt", { ascending: true })
      .order("id", { ascending: true })
      .range(de, ate),
  )

  if (error) return { itens: [], emAlta: [], erro: error }

  // Apelido do autor. Desde 2026-09-14 quem AUTORIZA a publicação já sai
  // assinado (primeiro nome da conta, mostrado antes do aceite e desligável
  // em Carreira) — ver legal/07. O acervo antigo segue anônimo de propósito:
  // aquelas pessoas aceitaram um texto que prometia o contrário, e a regra
  // nova não é retroativa. Então pedido sem apelido aqui é o esperado, não um
  // bug — como também é o caso do checkout sem conta, que nem userId tem.
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

  // Destaque por aplauso (migração 064). Vem pronto do banco com as travas
  // aplicadas: janela de 30 dias, piso de ouvintes distintos, aplauso do
  // dono fora e contas da casa fora. Aqui só se lê.
  //
  // Tolera a migração não ter rodado: sem a função, a prateleira não aparece
  // e o resto da Rede segue igual.
  type DestaqueRow = { orderId: string; palmas_janela: number; ouvintes_janela: number; por_ouvinte: number | null; palmas_total: number }
  const { data: destaques, error: erroDestaque } = await supabase.rpc("destaque_aplauso", { p_dias: 30, p_piso: 3 })
  if (erroDestaque) console.warn("[catalog] destaque_aplauso indisponível:", erroDestaque.message)
  const emAltaOrdem: string[] = []
  const palmasPorPedido: Record<string, number> = {}
  for (const d of (destaques as DestaqueRow[] | null) ?? []) {
    emAltaOrdem.push(d.orderId)
    palmasPorPedido[d.orderId] = Number(d.palmas_total) || 0
  }

  const ids = (orders ?? []).map((o) => o.id)
  type MusicRow = { orderId: string; slug: string | null; mp3Url: string | null; musicName: string | null; musicNameConfirmed: boolean | null; publishedAt: string | null }
  const gm = await porLotesDeIds<MusicRow>(ids, (lote) =>
    supabase.from("generated_music").select("orderId, slug, mp3Url, musicName, musicNameConfirmed, publishedAt").in("orderId", lote),
  )
  const musicByOrder: Record<string, { slug: string | null; mp3Url: string | null; musicName: string | null; musicNameConfirmed: boolean; publishedAt: string | null }> = {}
  for (const g of gm ?? []) musicByOrder[g.orderId as string] = {
    slug: g.slug ?? null,
    mp3Url: g.mp3Url ?? null,
    musicName: g.musicName ?? null,
    musicNameConfirmed: !!g.musicNameConfirmed,
    publishedAt: g.publishedAt ?? null,
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
        occasion: rotuloOcasiao(o.subcategory),
        musicalStyle: o.musicalStyle ?? null,
        imageUrl: principal?.imageUrl ?? null,
        audioUrl,
        apelidoPublico: dono ? apelidoPublico[dono] ?? null : null,
        apelidoProprio: dono ? apelidoProprio[dono] ?? null : null,
        plays: playsPorPedido[o.id]?.total ?? 0,
        playsRecentes: playsPorPedido[o.id]?.recentes ?? 0,
        palmas: palmasPorPedido[o.id] ?? 0,
        createdAt: o.createdAt as string,
        publishedAt: music.publishedAt,
        autorKey: dono ?? (o.email?.trim() ? `email:${o.email.trim().toLowerCase()}` : `pedido:${o.id}`),
        isRevision: !!o.is_revision,
      }
    })
    .filter((x): x is ItemBase => x !== null)

  cache = { em: Date.now(), itens, emAlta: emAltaOrdem }
  return { itens, emAlta: emAltaOrdem }
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

  const { itens: base, emAlta: emAltaOrdem, erro } = await catalogoBase()
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
        : tituloNeutro(b.occasion),
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
      palmas: b.palmas,
      favorited: favoriteSet.has(b.orderId),
      createdAt: b.createdAt,
      // Data de publicação: é o que a raia "Mais recentes" mostra no cartão.
      // Sem ela a raia diria "mais recentes" sem nada que comprove.
      publishedAt: b.publishedAt,
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
  // Estilos contados pelo nome UNIFICADO (ver lib/ritmo.ts): o emoji faz parte
  // do texto gravado, então "🎵 Forró" e "🪗 Forró" contavam como dois ritmos.
  // A contagem e o filtro têm que usar a mesma chave — se o filtro unificasse
  // e a faceta não, a pílula prometeria 5 e a lista entregaria 7, que é o erro
  // de "promete 6 e entrega 9" já corrigido uma vez (78faf4d).
  const ocasioes: Record<string, number> = {}
  const estilos: Record<string, number> = {}
  for (const i of porBusca) {
    ocasioes[i.occasion] = (ocasioes[i.occasion] ?? 0) + 1
    for (const e of ritmosDa(i.musicalStyle)) {
      estilos[e] = (estilos[e] ?? 0) + 1
    }
  }

  // O filtro aceita tanto o nome puro ("Forró", vindo do mural) quanto o
  // rótulo com emoji ("🎵 Forró", vindo de link antigo ou da pílula): os dois
  // lados passam pela mesma normalização.
  const estiloAlvo = estilo ? nomeDoRitmo(estilo) : null
  // Ocasião que na verdade é RITMO sai da lista de ocasiões.
  //
  // As músicas da vitrine da casa (context "Vitrine Fiz Música") gravam o
  // gênero no lugar da ocasião, então "Rock", "Samba", "MPB", "Axé" e mais
  // seis apareciam entre "Dia dos Pais" e "Pedido em Namoro" — 10 das 32
  // pílulas de ocasião eram ritmo. Pedido do Audrei: nesse filtro, só ocasião.
  //
  // Compara com os ritmos DO ACERVO, não só com a lista oficial: "Pop Rock"
  // saiu da lista do wizard e continua no catálogo, e pela lista oficial
  // sozinha ele escaparia.
  //
  // As músicas não somem da Rede — elas continuam no mural, pelo ritmo, e na
  // busca. O que sai é a pílula.
  const nomesDeRitmo = new Set([...RITMOS.map(nomeDoRitmo), ...Object.keys(estilos)])
  for (const nome of Object.keys(ocasioes)) {
    if (nomesDeRitmo.has(nomeDoRitmo(nome))) delete ocasioes[nome]
  }

  const filtrados = porBusca.filter((i) => {
    if (ocasiao && i.occasion !== ocasiao) return false
    if (estiloAlvo && !ritmosDa(i.musicalStyle).includes(estiloAlvo)) return false
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

  // "Em alta": a ordem é a do banco (palmas por ouvinte na janela), não uma
  // reordenação feita aqui — duas definições do mesmo ranking divergiriam.
  // Índice sobre a lista PÚBLICA (`items`), não sobre a base: é dela que sai
  // o título com a trava do confirmado e o áudio pela rota protegida. Pegar
  // da base entregaria objeto com outra forma — foi o que aconteceu na
  // primeira tentativa, e o card veio sem título.
  const publicoPorId = new Map(items.map((i) => [i.orderId, i]))
  const emAlta = emAltaOrdem
    .map((id) => publicoPorId.get(id))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .slice(0, 10)

  // ── Mais recentes ─────────────────────────────────────────────────────
  //
  // Existe porque as outras duas prateleiras dependem de ACÚMULO (palmas por
  // ouvinte, reproduções): música recém-publicada entra nas duas com zero e
  // não aparece em nenhuma. E a grade principal é embaralhada, então a música
  // nova cai em posição aleatória entre 129 — na prática, invisível. Esta é a
  // única prateleira onde publicar já garante vitrine.
  //
  // UMA POR AUTOR, e isso não é detalhe: medido no acervo real, uma raia de 12
  // só por data traria 6 autores em 12 vagas, com UM deles ocupando 6 — e a
  // maior sequência já ocorrida é de 9 publicações seguidas da mesma pessoa.
  // Quem publica muito tomaria a prateleira e o objetivo ("todos terem a
  // condição de ser ouvida") viraria o contrário. Com a regra, as 12 vagas
  // viram 12 pessoas; há 22 autores elegíveis, então sobra folga.
  //
  // Tirar as revisões sozinho NÃO resolve: sem elas o maior ocupante subia de
  // 6 pra 7 (a vaga liberada ia pro mesmo autor). Elas ficam fora por outro
  // motivo — revisão é pedido duplicado, e a mesma música voltaria como
  // novidade dando duas vezes a vez a quem já teve.
  const ordemRecentes = [...items]
    .filter((i) => {
      const b = indicePorId.get(i.orderId)
      return !!b?.publishedAt && !b.isRevision
    })
    .sort((a, b) => dbTime(indicePorId.get(b.orderId)!.publishedAt!) - dbTime(indicePorId.get(a.orderId)!.publishedAt!))

  const autoresVistos = new Set<string>()
  const recentes: typeof items = []
  for (const i of ordemRecentes) {
    const chave = indicePorId.get(i.orderId)!.autorKey
    if (autoresVistos.has(chave)) continue
    autoresVistos.add(chave)
    recentes.push(i)
    if (recentes.length === 12) break
  }

  // ── Mural de ritmos ───────────────────────────────────────────────────
  //
  // Substitui a grade embaralhada de "todas as músicas": 129 cartões soltos
  // viravam rolagem sem fim e sem critério. Aqui cada ritmo é uma porta.
  //
  // Vem do catálogo INTEIRO (como o Top 10 e o Em alta), não da página nem da
  // busca — é um índice do acervo, não um recorte do que está na tela.
  //
  // A capa do banner é a de uma música REAL do ritmo: a mais aplaudida,
  // caindo pra mais ouvida e depois pra mais recente, então nunca fica sem
  // arte. Assim o mural não depende de nenhum arquivo em /public (que tem
  // cache longo e exige nome novo a cada troca) e se renova sozinho conforme
  // o acervo cresce.
  const porRitmo = new Map<string, typeof items>()
  for (const i of items) {
    for (const r of ritmosDa(i.musicalStyle)) {
      const lista = porRitmo.get(r)
      if (lista) lista.push(i)
      else porRitmo.set(r, [i])
    }
  }

  const ritmos = [...porRitmo.entries()]
    .map(([nome, musicas]) => {
      const capa = [...musicas].sort((a, b) =>
        (b.palmas ?? 0) - (a.palmas ?? 0)
        || (b.plays ?? 0) - (a.plays ?? 0)
        || dbTime(b.publishedAt ?? b.createdAt) - dbTime(a.publishedAt ?? a.createdAt),
      ).find((m) => m.imageUrl)?.imageUrl ?? null
      return { nome, rotulo: rotuloDoRitmo(nome), cor: corDoRitmo(nome), total: musicas.length, capa }
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"))

  return NextResponse.json(
    {
      items: pagina,
      top10,
      emAlta,
      recentes,
      ritmos,
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
