"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CatalogItem } from "./CatalogoContext"
import { supabase } from "@/lib/supabase"
import { usePlayer } from "./PlayerContext"
import AddToPlaylistModal from "./AddToPlaylistModal"
import CreatePlaylistModal from "./CreatePlaylistModal"
import { useToast } from "./ToastContext"
import { combina } from "@/lib/busca"
import { gradienteDaCapa } from "@/lib/capaGradiente"
import { useCatalogo } from "./CatalogoContext"
import { parseDbDate } from "@/lib/date"

// Rede Fiz Música: músicas de outros clientes que autorizaram divulgação.
// Nunca mostra o nome do homenageado (dado de terceiro sem consentimento
// próprio) nem fotos do cliente — só título real da música + ocasião +
// capa gerada pelo Suno, tudo vindo direto do banco (nada fixo).
type Playlist = { id: string; nome: string; track_order_ids: string[] }

// Contagem de reproduções em formato curto. Acima de mil, "1,2 mil" — o
// cartão tem 128px e "1247 plays" empurraria o resto pra fora.
function formatarPlays(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",").replace(",0", "")} mil`
  return String(n)
}

// Rótulo de quando a música foi publicada, para a raia "Mais recentes" — é a
// única informação que justifica a prateleira, então o cartão precisa mostrar.
// Relativo em vez de data: "há 3 dias" responde "isso é novo?" sem a pessoa ter
// que fazer a conta a partir de "22/10".
// Passa pelo `parseDbDate` porque `publishedAt` é `timestamp without time zone`
// e chega sem fuso — lido direto pelo `new Date` ele adianta ~3h e uma música
// publicada hoje de manhã podia aparecer como "amanhã".
function quandoPublicou(iso: string): string {
  const dias = Math.floor((Date.now() - parseDbDate(iso).getTime()) / 86_400_000)
  if (dias <= 0) return "hoje"
  if (dias === 1) return "ontem"
  if (dias < 7) return `há ${dias} dias`
  const semanas = Math.floor(dias / 7)
  if (semanas === 1) return "há 1 semana"
  if (dias < 30) return `há ${semanas} semanas`
  const meses = Math.floor(dias / 30)
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`
}

export default function RedeFizMusica({ onPlaylistsChanged, onPrecisaLogin }: {
  onPlaylistsChanged?: () => void
  onPrecisaLogin?: () => void
}) {
  const { items, top10, emAlta, recentes, ritmos, setFiltro, alternarFavorito } = useCatalogo()
  const { track: nowPlaying, playing, playOuPausa } = usePlayer()
  const { showToast } = useToast()

  // Playlist é a mesma tabela/API de "Minhas Músicas" (guarda ids de pedido,
  // não importa se o pedido é seu ou de outra pessoa), só que com fetch
  // próprio: os dois cartões vivem em componentes separados na tela, não
  // vale a pena compartilhar estado por isso.
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null)
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null)
  // Criação de playlist: orderId fica pendente enquanto o modal de nome está
  // aberto — undefined quando a playlist nasce vazia.
  const [creatingPlaylistOpen, setCreatingPlaylistOpen] = useState(false)
  const [pendingOrderId, setPendingOrderId] = useState<string | undefined>(undefined)

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" }
  }

  // Protegido porque roda na montagem: falha de rede aqui virava erro não
  // tratado (visto no Sentry em MinhasPlaylists, mesmo padrão).
  async function carregarPlaylists() {
    try {
      const headers = await authHeaders()
      const res = await fetch("/api/playlists", { headers })
      const d = await res.json().catch(() => ({}))
      const lista: Playlist[] = d.playlists ?? []
      setPlaylists(lista)
      return lista
    } catch {
      setPlaylists([])
      return [] as Playlist[]
    }
  }

  useEffect(() => { carregarPlaylists() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function abrirAdicionar(orderId: string) {
    // Sem conta, o botão não some nem fica cinza: ele CONVIDA. É o gatilho de
    // cadastro mais natural que existe aqui — a pessoa já quis guardar algo.
    if (onPrecisaLogin) { onPrecisaLogin(); return }
    // Recarrega antes de decidir — este cartão só busca playlists no mount,
    // então uma playlist criada em "Minhas Músicas" (estado separado) não
    // apareceria aqui sem isso.
    const headers = await authHeaders()
    const res = await fetch("/api/playlists", { headers })
    const d = await res.json().catch(() => ({}))
    const lista: Playlist[] = d.playlists ?? []
    setPlaylists(lista)
    // Só uma playlist existente? Adiciona direto, sem perguntar qual —
    // o popup de escolher só faz sentido quando há de fato uma escolha.
    if (lista.length === 1) {
      adicionarNaPlaylist(lista[0].id, orderId)
    } else {
      setAddingTrackId(orderId)
    }
  }

  function abrirCriarPlaylist(orderId?: string) {
    setPendingOrderId(orderId)
    setCreatingPlaylistOpen(true)
  }

  async function confirmarCriarPlaylist(nome: string) {
    setCreatingPlaylistOpen(false)
    const headers = await authHeaders()
    const res = await fetch("/api/playlists", { method: "POST", headers, body: JSON.stringify({ nome, orderId: pendingOrderId }) })
    // Nome repetido (o popup já avisa, mas o servidor é quem decide) ou falha.
    if (!res.ok) { const j = await res.json().catch(() => ({})); showToast(j.error ?? "Não foi possível criar a playlist."); return }
    await carregarPlaylists()
    onPlaylistsChanged?.()
    // Só o toast: a raia em "Minha playlist" já mostra o resultado, abrir um
    // modal por cima obrigava a fechar algo que o cliente não pediu.
    showToast("Adicionado com sucesso ✓")
  }

  async function adicionarNaPlaylist(playlistId: string, orderId: string) {
    const headers = await authHeaders()
    await fetch(`/api/playlists/${playlistId}`, { method: "PATCH", headers, body: JSON.stringify({ addOrderId: orderId }) })
    await carregarPlaylists()
    onPlaylistsChanged?.()
    showToast("Adicionado com sucesso ✓")
  }

  async function favoritar(orderId: string) {
    if (onPrecisaLogin) { onPrecisaLogin(); return }
    // Otimista: o contexto alterna e reordena, pra a raia daqui e a lista de
    // resultados nunca discordarem sobre o que está favoritado.
    alternarFavorito(orderId)
    const headers = await authHeaders()
    await fetch("/api/catalog/favorite", { method: "POST", headers, body: JSON.stringify({ orderId }) }).catch(() => {})
  }

  // Este componente só existe no modo NAVEGAÇÃO (ver AbaMusicas): com busca
  // ou filtro ativo a tela troca pela lista de resultados.
  //

  // Setas do carrossel "Mais recentes". No celular o dedo arrasta e elas não
  // aparecem; no desktop, sem elas a raia dependia da barra de rolagem
  // horizontal (que o macOS esconde) ou de shift+roda — ou seja, metade das
  // 12 músicas ficaria invisível justamente na prateleira criada pra dar
  // vitrine a quem publicou. Cada seta anda uma "tela" da raia.
  const raiaRecentesRef = useRef<HTMLDivElement>(null)
  const [setas, setSetas] = useState({ esq: false, dir: false })

  const medirSetas = useCallback(() => {
    const el = raiaRecentesRef.current
    if (!el) return
    // Margem de 2px: com zoom do navegador o scrollWidth vem fracionário e a
    // seta da direita ficava acesa pra sempre no fim da raia.
    const esq = el.scrollLeft > 2
    const dir = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    // Só troca o estado quando MUDA de verdade. Isto roda no onScroll, que
    // dispara a cada quadro do arrasto — devolver um objeto novo toda vez
    // re-renderizaria os 12 cartões dezenas de vezes por rolagem.
    setSetas((s) => (s.esq === esq && s.dir === dir ? s : { esq, dir }))
  }, [])

  // Remede quando a raia chega (ela nasce vazia e só preenche depois do fetch)
  // e quando a janela muda de tamanho.
  useEffect(() => {
    medirSetas()
    window.addEventListener("resize", medirSetas)
    return () => window.removeEventListener("resize", medirSetas)
  }, [recentes.length, medirSetas])

  function rolarRecentes(direcao: -1 | 1) {
    const el = raiaRecentesRef.current
    if (!el) return
    el.scrollBy({ left: direcao * el.clientWidth * 0.8, behavior: "smooth" })
  }

  const itensBusca = items ?? []

  // Converte um item da Rede na faixa que o player entende. Existe porque a
  // mesma conversão era repetida nos dois cartões (favoritos e grade) e
  // agora precisa servir também pra montar a FILA — sem ela, a fila e a
  // faixa clicada poderiam divergir num campo e o "próxima" pularia errado.
  const paraFaixa = (it: (typeof itensBusca)[number]) => ({
    id: it.orderId, title: it.title, occasion: it.occasion,
    audioUrl: it.audioUrl, imageUrl: it.imageUrl,
    lyrics: it.lyrics ?? null, lyricsLrc: it.lyricsLrc ?? null,
    apelido: it.authorApelido,
    // Tudo que aparece na Rede tem endereço público, por definição — é o que
    // decide se o player mostra favoritar e compartilhar. Sem isso o player
    // caía numa busca na lista carregada, e faixa do Top 10 ou de página não
    // carregada ficava sem botão.
    publico: true, minha: false,
  })

  if (!items || items.length === 0) return null

  // A prateleira de Favoritas sobreviveu à grade: ela é a única parte do
  // antigo bloco que mostrava música solta, e é de onde se DESfavorita.
  // Limite conhecido, herdado: ela enxerga só a primeira página do catálogo,
  // então favorito que esteja fora das 40 primeiras não aparece aqui.
  const favoritados = itensBusca.filter((it) => it.favorited)
  return (
    <div className="mb-9">
      {/* O título "SpotFiz", a descrição e a contagem moram no TOPO da aba
          (AbaMusicas), acima da busca — pedido do Audrei, 2026-10-10. */}
      {/* ── Top 10 mais ouvidas ──────────────────────────────────────
          Ranking real, vindo da contagem de reproduções (migração 057),
          não uma seleção editorial. Fica ESCONDIDO enquanto ninguém
          ouviu nada: uma lista numerada cheia de zeros passaria a
          impressão de ranking sem ser um.
          Lista numerada em vez da grade de capas porque a posição é a
          informação principal aqui — numa raia de capas iguais às de
          baixo, o "1º lugar" se perde. */}
      {/* EM ALTA — palmas por ouvinte nos últimos 30 dias.
          Prateleira separada do Top 10 de propósito: são perguntas
          diferentes. Top 10 é "o que mais tocou"; Em alta é "o que mais
          emocionou quem ouviu" — proporção, não volume, então música nova
          não perde pra velha e música muito exibida não ganha por exposição.
          Só aparece quando há material: a ordem vem do banco com piso de
          ouvintes distintos, e prateleira vazia é melhor que pódio decidido
          por duas pessoas. */}
      {emAlta.length > 0 && (
        <div className="mb-5 pb-5 border-b border-white/5">
          <p className="text-sm font-extrabold uppercase tracking-wider mb-2.5">
            <span style={{ color: "#f0196b" }}>Em alta</span>{" "}
            <span className="text-white/90">mais aplaudidas</span>
          </p>
          <div className="grid sm:grid-cols-2 gap-x-6">
            {emAlta.map((it, i) => {
              const isPlaying = nowPlaying?.id === it.orderId && playing
              return (
                <button
                  key={it.orderId}
                  type="button"
                  onClick={() => playOuPausa(paraFaixa(it), emAlta.map(paraFaixa))}
                  className="w-full flex items-center gap-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                >
                  <span className={`w-5 text-center text-sm font-bold tabular-nums shrink-0 ${i < 3 ? "text-pink-400" : "text-white/30"}`}>
                    {i + 1}
                  </span>
                  <div
                    data-zona-escura
                    className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 bg-cover bg-center"
                    style={it.imageUrl ? { backgroundImage: `url(${it.imageUrl})` } : { background: gradienteDaCapa(it.orderId) }}
                  >
                    {isPlaying && <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-sm">❚❚</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${isPlaying ? "text-pink-300" : ""}`}>{it.title}</p>
                    {/* Autor ANTES da ocasião: numa linha que trunca, o que vem
                        primeiro é o que sobrevive — e aqui o nome é o que o
                        Audrei quis ver. A ocasião já aparece inteira na grade
                        de capas, esta linha é o resumo.
                        O apelido só chega pra quem está logado e só de quem
                        ligou "Mostrar meu apelido" (ver /api/catalog); sem
                        ele vale o rótulo neutro, igual à grade. */}
                    <p className="text-[13px] text-white/45 truncate">
                      <span className={it.authorApelido ? "" : "italic text-white/35"}>
                        {it.authorApelido ?? "Membro da Rede"}
                      </span>
                      <span className="text-white/30"> · {it.occasion}</span>
                    </p>
                  </div>
                  <span className="text-[13px] text-white/45 tabular-nums shrink-0">
                    {(it.palmas ?? 0).toLocaleString("pt-BR")} 👏
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MAIS RECENTES ────────────────────────────────────────────
          Última publicada de cada autor, em ordem de data/hora. É a única
          prateleira sem mérito acumulado: as outras duas exigem palmas ou
          reproduções, que música nova não tem, e a grade grande é
          embaralhada — sem esta raia, publicar não garantia vitrine nenhuma.

          A regra de UMA POR AUTOR mora no servidor (ver /api/catalog) junto
          da medição que a motivou.

          CARROSSEL em vez de grade, nas duas larguras: a raia são 12 cartões
          de 128px, e deixar quebrar linha no desktop acrescentaria uma
          segunda fileira de ~190px de altura empurrando o Top 10 e a
          playlist do cliente pra baixo. Pedido do Audrei: "arrastar para o
          lado tipo carrossel, para não ocupar". Por isso NÃO tem
          `sm:flex-wrap` como a raia de Favoritas.

          Sem numeração, ao contrário do Top 10 e do Em alta: lá a posição é
          a informação ("1ª em palmas"); aqui "1º lugar" só quer dizer que
          publicou por último, e numerar fingiria um ranking que não existe. */}
      {recentes.length > 0 && (
        <div className="mb-5 pb-5 border-b border-white/5">
          <p className="text-sm font-extrabold uppercase tracking-wider mb-2.5">
            <span style={{ color: "#22d3ee" }}>Mais recentes</span>{" "}
            <span className="text-white/90">acabaram de chegar</span>
          </p>

          <div className="relative">
            <div
              ref={raiaRecentesRef}
              onScroll={medirSetas}
              // `snap` dá o encaixe de carrossel no arrasto do dedo, em vez de
              // parar com um cartão cortado no meio.
              // `-mx-5 px-5` faz a raia sangrar até as bordas da tela: sem
              // isso o primeiro e o último cartão ficam com uma faixa morta do
              // lado e a raia parece ter acabado antes do fim.
              // `scroll-pl-5` acompanha o `px-5`: sem ele o encaixe do snap
              // alinha o cartão à borda do scrollport IGNORANDO o padding, e a
              // raia nascia com `scrollLeft: 20` — o primeiro cartão colado na
              // beira da tela enquanto o título e o Top 10 respeitavam a
              // margem. Medido aqui, não é teoria.
              className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory scroll-pl-5 sm:scroll-pl-0 pb-2 -mx-5 px-5 sm:mx-0 sm:px-0"
            >
              {recentes.map((it) => {
                const isPlaying = nowPlaying?.id === it.orderId && playing
                return (
                  <div key={it.orderId} className="shrink-0 w-32 snap-start group">
                    <div className="relative w-32 h-32 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => playOuPausa(paraFaixa(it), recentes.map(paraFaixa))}
                        className="block w-full h-full"
                        aria-label={`Tocar ${it.title}`}
                      >
                        <div
                          className="w-full h-full bg-cover bg-center"
                          style={it.imageUrl ? { backgroundImage: `url(${it.imageUrl})` } : { background: gradienteDaCapa(it.orderId) }}
                        />
                        {isPlaying && <div className="absolute inset-0 bg-black/35 flex items-center justify-center text-2xl">❚❚</div>}
                      </button>
                      <button
                        onClick={() => favoritar(it.orderId)}
                        aria-label={it.favorited ? "Remover dos favoritos" : "Favoritar"}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-sm transition-transform hover:scale-110"
                      >
                        {it.favorited ? "❤️" : "🤍"}
                      </button>
                      {/* `data-zona-escura` obrigatório: o "+" é texto branco
                          sobre a capa, e a camada do tema claro escurece
                          `.text-white` — sem a marca o sinal desaparecia
                          (consertado em 08f4192, mesma causa). */}
                      <button
                        type="button"
                        onClick={() => abrirAdicionar(it.orderId)}
                        aria-label="Adicionar à playlist"
                        data-zona-escura
                        className="absolute top-1.5 right-9 w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white text-sm font-bold transition-transform hover:scale-110"
                      >
                        +
                      </button>
                      {/* A data fica SOBRE A CAPA, não nas linhas de texto.
                          O cartão tem 128px e cabem ~20 caracteres por linha:
                          dividindo com a ocasião ela virava "Composiçã…", e
                          dividindo com o autor virava "Memb… há 1 semana". Na
                          capa ela não disputa espaço com ninguém — e nesta
                          prateleira a data é justamente o que justifica a
                          música estar ali. */}
                      {it.publishedAt && (
                        <span
                          data-zona-escura
                          className="absolute bottom-1.5 left-1.5 rounded-full bg-black/65 backdrop-blur px-2 py-0.5 text-[11px] font-medium text-white"
                        >
                          {quandoPublicou(it.publishedAt)}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-medium mt-2 truncate transition-colors ${isPlaying ? "text-cyan-300" : "group-hover:text-cyan-300"}`}>
                      {it.title}
                    </p>
                    <p className="text-[13px] text-white/40 truncate">{it.occasion}</p>
                    <p className={`text-[13px] truncate ${it.authorApelido ? "text-white/55" : "text-white/25 italic"}`}
                       title={it.authorApelido ?? "Este autor não escolheu aparecer na Rede"}>
                      {it.authorApelido ?? "Membro da Rede"}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Só no desktop — ver o comentário em `setas`. `-translate-y-1/2`
                centra na altura da CAPA (128px), não do cartão inteiro, senão
                a seta desce pra cima do nome do autor. */}
            {setas.esq && (
              <button
                type="button"
                onClick={() => rolarRecentes(-1)}
                aria-label="Ver as anteriores"
                data-zona-escura
                className="hidden sm:flex absolute left-0 top-16 -translate-y-1/2 w-9 h-9 rounded-full bg-black/70 backdrop-blur items-center justify-center text-white text-lg hover:bg-black/90 transition-colors"
              >
                ‹
              </button>
            )}
            {setas.dir && (
              <button
                type="button"
                onClick={() => rolarRecentes(1)}
                aria-label="Ver as próximas"
                data-zona-escura
                className="hidden sm:flex absolute right-0 top-16 -translate-y-1/2 w-9 h-9 rounded-full bg-black/70 backdrop-blur items-center justify-center text-white text-lg hover:bg-black/90 transition-colors"
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}

      {top10.length > 0 && (
        <div className="mb-5 pb-5 border-b border-white/5">
          {/* Rótulo FIXO em "Top 10": é o nome da seção, não a contagem.
              Interpolar o tamanho da lista produzia "Top 1 mais ouvidas"
              enquanto só uma música tinha reprodução. */}
          {/* Mais destaque que o rótulo vizinho das Favoritas (10px, branco
              a 30%), e sem emoji — pedido do Audrei. O ranking é a única
              coisa desta tela que sai de dado real, então merece hierarquia
              própria em vez de parecer mais um subtítulo.
              Duas cores: "Top 10" no roxo da marca puxa o olho para o
              número, e "mais ouvidas" em branco carrega a leitura. */}
          <p className="text-sm font-extrabold uppercase tracking-wider mb-2.5">
            <span style={{ color: "#d946ef" }}>Top 10</span>{" "}
            <span className="text-white/90">mais ouvidas</span>
          </p>
          <div className="grid sm:grid-cols-2 gap-x-6">
            {top10.map((it, i) => {
              const isPlaying = nowPlaying?.id === it.orderId && playing
              return (
                <button
                  key={it.orderId}
                  type="button"
                  onClick={() => playOuPausa(paraFaixa(it), top10.map(paraFaixa))}
                  className="w-full flex items-center gap-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                >
                  {/* Tabular pra 1 e 10 ficarem alinhados na coluna */}
                  <span className={`w-5 text-center text-sm font-bold tabular-nums shrink-0 ${i < 3 ? "text-fuchsia-400" : "text-white/30"}`}>
                    {i + 1}
                  </span>
                  <div
                    data-zona-escura
                    className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 bg-cover bg-center"
                    style={it.imageUrl ? { backgroundImage: `url(${it.imageUrl})` } : { background: gradienteDaCapa(it.orderId) }}
                  >
                    {isPlaying && <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-sm">❚❚</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${isPlaying ? "text-fuchsia-300" : ""}`}>{it.title}</p>
                    <p className="text-[13px] text-white/45 truncate">
                      <span className={it.authorApelido ? "" : "italic text-white/35"}>
                        {it.authorApelido ?? "Membro da Rede"}
                      </span>
                      <span className="text-white/30"> · {it.occasion}</span>
                    </p>
                  </div>
                  <span className="text-[13px] text-white/40 tabular-nums shrink-0">
                    {formatarPlays(it.plays ?? 0)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {favoritados.length > 0 && (
        <div className="mb-5 pb-5 border-b border-white/5">
          <p className="text-[11px] uppercase tracking-wide font-bold text-white/30 mb-2">❤️ Favoritas — toque no + para adicionar a uma playlist</p>
          <div className="flex gap-3.5 overflow-x-auto sm:flex-wrap sm:overflow-x-visible pb-2 -mx-5 sm:mx-0 px-5 sm:px-0">
            {favoritados.map((it) => {
              const isPlaying = nowPlaying?.id === it.orderId && playing
              return (
                <div key={it.orderId} className="shrink-0 w-32 group">
                  <div
                    className="relative w-32 h-32 rounded-xl overflow-hidden bg-cover bg-center"
                    style={it.imageUrl ? { backgroundImage: `url(${it.imageUrl})` } : { background: gradienteDaCapa(it.orderId) }}
                  >
                    <button
                      type="button"
                      onClick={() => playOuPausa(paraFaixa(it), favoritados.map(paraFaixa))}
                      className="absolute inset-0 flex items-center justify-center text-2xl"
                    >
                      {isPlaying && <div className="absolute inset-0 bg-black/35 rounded-xl flex items-center justify-center text-xl">❚❚</div>}
                    </button>
                    {/* Desfavoritar mora AQUI porque a grade abaixo deixou de
                        mostrar o que já é favorito — sem este botão, favoritar
                        viraria caminho sem volta. */}
                    <button
                      type="button"
                      onClick={() => favoritar(it.orderId)}
                      aria-label="Remover dos favoritos"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-[13px] hover:scale-110 transition-transform"
                    >
                      ❤️
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirAdicionar(it.orderId)}
                      aria-label="Adicionar à playlist"
                      data-zona-escura
                  className="absolute top-1.5 right-8 w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white text-[13px] font-bold hover:scale-110 transition-transform"
                    >
                      +
                    </button>
                  </div>
                  <p className={`text-sm font-medium mt-2 truncate transition-colors ${isPlaying ? "text-fuchsia-300" : "group-hover:text-fuchsia-300"}`}>{it.title}</p>
                  {/* Autor também aqui: era o último cartão do SpotFiz que
                      mostrava só o título. */}
                  <p className={`text-[13px] truncate ${it.authorApelido ? "text-white/55" : "text-white/25 italic"}`}
                     title={it.authorApelido ?? "Este autor não escolheu aparecer na Rede"}>
                    {it.authorApelido ?? "Membro da Rede"}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MURAL DE RITMOS ──────────────────────────────────────────
          Substituiu a grade embaralhada de "todas as músicas".

          A grade era 129 cartões soltos em ordem aleatória — rolagem sem
          fim e sem critério, e a playlist do cliente ficava longe demais
          (já tinha teto de 3 linhas e um "ver todas" só pra isso). Agora
          cada ritmo é uma porta, e a tela cabe de uma vez.

          TODOS os ritmos aparecem, no mesmo formato. Já foram nove banners
          mais um "Ver todos", e depois nove banners mais a cauda em
          pastilhas menores — o Audrei viu as duas e pediu padrão único
          (2026-10-27). O mural fica mais alto; em troca, nenhum ritmo
          depende de a pessoa descobrir que havia mais.

          A ordem é por quantidade de músicas (ver /api/catalog), então os
          maiores continuam aparecendo primeiro.

          Tocar num banner aplica o filtro do ritmo — e aí AbaMusicas troca
          a tela pela lista daquele ritmo, o mesmo caminho das pílulas. O
          endereço guarda o ritmo (ver CatalogoContext), então Voltar traz
          o mural de novo em vez de sair da aba. */}
      {ritmos.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-extrabold uppercase tracking-wider mb-2.5">
            <span className="text-white/90">Navegue por</span>{" "}
            <span style={{ color: "#f0196b" }}>ritmo</span>
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
            {(() => {
              const visiveis = ritmos
              return visiveis.map((r, i) => (
              <button
                key={r.nome}
                type="button"
                onClick={() => setFiltro({ tipo: "estilo", valor: r.nome })}
                data-zona-escura
                // Último banner ocupa a linha inteira quando a conta é ímpar
                // e a grade tem duas colunas (tudo abaixo de lg). Recolhido
                // são nove, e o nono ficava sozinho com um buraco do lado —
                // que lê como falha de carregamento, não como fim da lista.
                // Em três colunas nove fecham certinho, então lá não se mexe.
                className={`relative h-24 rounded-xl overflow-hidden text-left p-3 transition-transform hover:scale-[1.02] active:scale-[0.98] ${
                  i === visiveis.length - 1 && visiveis.length % 2 === 1 ? "col-span-2 lg:col-span-1" : ""
                }`}
                style={{ background: r.cor }}
              >
                {/* `pr-12` reserva o canto da capa inclinada: sem isso nome
                    comprido ("🙌 Gospel Soul") corria por baixo dela e era
                    cortado pelo overflow do banner. Com a reserva ele quebra
                    em duas linhas, que cabem na altura. */}
                <span className="relative z-10 block pr-12 text-[15px] font-bold leading-tight text-white drop-shadow-sm">
                  {r.rotulo}
                </span>
                {/* /85 e não /70: nos banners claros (Sertanejo, Forró) o
                    branco rebaixado encostava no limite de contraste, e a
                    tela já carrega dívida demais nesse ponto. */}
                <span className="relative z-10 block text-[11px] font-medium text-white/85 mt-0.5">
                  {r.total} {r.total === 1 ? "música" : "músicas"}
                </span>
                {/* Capa de uma música REAL do ritmo, inclinada e saindo pelo
                    canto — é o que dá identidade ao banner sem depender de
                    arte fixa em /public (que tem cache longo e exigiria nome
                    novo a cada troca). Ritmo sem capa nenhuma simplesmente
                    não ganha a miniatura; o banner continua legível. */}
                {r.capa && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-2 -right-3 w-[4.5rem] h-[4.5rem] rounded-md bg-cover bg-center shadow-lg rotate-[25deg]"
                    style={{ backgroundImage: `url(${r.capa})` }}
                  />
                )}
              </button>
              ))
            })()}
          </div>

        </div>
      )}

      <AddToPlaylistModal
        open={!!addingTrackId}
        playlists={playlists}
        onClose={() => setAddingTrackId(null)}
        onAdd={(playlistId) => { if (addingTrackId) adicionarNaPlaylist(playlistId, addingTrackId) }}
        onCreateNew={() => abrirCriarPlaylist(addingTrackId ?? undefined)}
      />
      <CreatePlaylistModal
        open={creatingPlaylistOpen}
        onClose={() => setCreatingPlaylistOpen(false)}
        onCreate={confirmarCriarPlaylist}
      />
    </div>
  )
}
