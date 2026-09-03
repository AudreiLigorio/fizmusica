"use client"

import { useEffect, useRef, useState } from "react"
import type { CatalogItem } from "./CatalogoContext"
import { supabase } from "@/lib/supabase"
import { usePlayer } from "./PlayerContext"
import AddToPlaylistModal from "./AddToPlaylistModal"
import CreatePlaylistModal from "./CreatePlaylistModal"
import { useToast } from "./ToastContext"
import InfoTooltip from "./InfoTooltip"
import { combina } from "@/lib/busca"
import { gradienteDaCapa } from "@/lib/capaGradiente"
import { useCatalogo } from "./CatalogoContext"

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

export default function RedeFizMusica({ onPlaylistsChanged, onPrecisaLogin }: { onPlaylistsChanged?: () => void; onPrecisaLogin?: () => void }) {
  const { items, top10, alternarFavorito, temMais, carregando, carregarMais, total } = useCatalogo()
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

  async function carregarPlaylists() {
    const headers = await authHeaders()
    const res = await fetch("/api/playlists", { headers })
    const d = await res.json().catch(() => ({}))
    const lista: Playlist[] = d.playlists ?? []
    setPlaylists(lista)
    return lista
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
    await fetch("/api/playlists", { method: "POST", headers, body: JSON.stringify({ nome, orderId: pendingOrderId }) })
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
  // ou filtro ativo a tela troca pela lista de resultados. Então aqui não há
  // mais filtragem — os itens vêm prontos do servidor, já paginados.
  // Scroll infinito. `carregando` entra na dependência pra não disparar duas
  // páginas ao mesmo tempo enquanto a primeira ainda está vindo.
  const sentinelaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const alvo = sentinelaRef.current
    if (!alvo || !temMais || carregando) return
    const obs = new IntersectionObserver(
      (entradas) => { if (entradas[0]?.isIntersecting) carregarMais() },
      { rootMargin: "400px" },
    )
    obs.observe(alvo)
    return () => obs.disconnect()
  }, [temMais, carregando, carregarMais])

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
  })

  if (!items || items.length === 0) return null

  // Este componente só existe no modo NAVEGAÇÃO agora: quando há busca ou
  // filtro ativo, a tela troca pela lista de resultados (ResultadosBusca), e
  // as pílulas moram junto da busca (FiltrosMusica). Por isso aqui não há
  // mais agrupamento nem estado de filtro — a raia mostra o catálogo inteiro.
  const favoritados = itensBusca.filter((it) => it.favorited)
  const visiveis = itensBusca

  return (
    <div className="mb-9">
      {/* Sem card/borda de propósito — título grande em serifa separa esta
          seção da próxima, mesma lógica do Spotify aplicada nas outras duas
          telas de música. */}
      <div className="flex items-center gap-2.5 mb-1">
        <h2 className="text-xl font-bold flex-1 min-w-0 truncate">Rede Fiz Música</h2>
        <InfoTooltip text="Explore músicas de outros usuários, comente, curta e divirta-se." />
      </div>
      <p className="text-xs text-white/50 mb-4">Escute músicas publicadas por outros usuários</p>

      {/* ── Top 10 mais ouvidas ──────────────────────────────────────
          Ranking real, vindo da contagem de reproduções (migração 057),
          não uma seleção editorial. Fica ESCONDIDO enquanto ninguém
          ouviu nada: uma lista numerada cheia de zeros passaria a
          impressão de ranking sem ser um.
          Lista numerada em vez da grade de capas porque a posição é a
          informação principal aqui — numa raia de capas iguais às de
          baixo, o "1º lugar" se perde. */}
      {top10.length > 0 && (
        <div className="mb-5 pb-5 border-b border-white/5">
          {/* Rótulo FIXO em "Top 10": é o nome da seção, não a contagem.
              Interpolar o tamanho da lista produzia "Top 1 mais ouvidas"
              enquanto só uma música tinha reprodução. */}
          <p className="text-[10px] uppercase tracking-wide font-bold text-white/30 mb-2">
            🔥 Top 10 mais ouvidas
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
                    className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 bg-cover bg-center"
                    style={it.imageUrl ? { backgroundImage: `url(${it.imageUrl})` } : { background: gradienteDaCapa(it.orderId) }}
                  >
                    {isPlaying && <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-xs">❚❚</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium truncate ${isPlaying ? "text-fuchsia-300" : ""}`}>{it.title}</p>
                    <p className="text-[11px] text-white/35 truncate">{it.occasion}</p>
                  </div>
                  <span className="text-[11px] text-white/40 tabular-nums shrink-0">
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
          <p className="text-[10px] uppercase tracking-wide font-bold text-white/30 mb-2">❤️ Favoritas — toque no + para adicionar a uma playlist</p>
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
                    <button
                      type="button"
                      onClick={() => abrirAdicionar(it.orderId)}
                      aria-label="Adicionar à playlist"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-xs font-bold hover:scale-110 transition-transform"
                    >
                      +
                    </button>
                  </div>
                  <p className={`text-xs font-medium mt-2 truncate transition-colors ${isPlaying ? "text-fuchsia-300" : "group-hover:text-fuchsia-300"}`}>{it.title}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pílulas movidas pra FiltrosMusica, logo abaixo da busca. */}

      <div className="flex gap-3.5 overflow-x-auto sm:flex-wrap sm:overflow-x-visible pb-2 -mx-5 sm:mx-0 px-5 sm:px-0">
        {visiveis.map((it) => {
          const isPlaying = nowPlaying?.id === it.orderId && playing
          return (
            <div key={it.orderId} className="shrink-0 w-32">
              <div className="relative w-32 h-32 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => playOuPausa(paraFaixa(it), visiveis.map(paraFaixa))}
                  className="block w-full h-full"
                >
                  <div className="w-full h-full bg-cover bg-center" style={it.imageUrl ? { backgroundImage: `url(${it.imageUrl})` } : { background: gradienteDaCapa(it.orderId) }} />
                  {isPlaying && <div className="absolute inset-0 bg-black/35 flex items-center justify-center text-2xl">❚❚</div>}
                </button>
                <button
                  onClick={() => favoritar(it.orderId)}
                  aria-label={it.favorited ? "Remover dos favoritos" : "Favoritar"}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-sm transition-transform hover:scale-110"
                >
                  {it.favorited ? "❤️" : "🤍"}
                </button>
                <button
                  type="button"
                  onClick={() => abrirAdicionar(it.orderId)}
                  aria-label="Adicionar à playlist"
                  className="absolute top-1.5 right-9 w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-sm font-bold transition-transform hover:scale-110"
                >
                  +
                </button>
              </div>
              <p className={`text-xs font-medium mt-2 truncate ${isPlaying ? "text-fuchsia-300" : ""}`}>{it.title}</p>
              {/* Apelido em LINHA PRÓPRIA, não "ocasião | apelido" na mesma.
                  O card tem 128px e a ocasião sozinha já truncava ("Já tenho a
                  composição da…") — inline, o apelido virava "| Lig…", que é
                  pior que não mostrar. Na mesma linha só funciona no player,
                  que tem a largura da tela.

                  Só vem da API pra quem está logado, e só de quem ligou
                  "Mostrar meu apelido na Rede" (opt-in separado do
                  consentimento de publicação). Nulo na maioria dos cards, e
                  isso é o esperado — não é falta de dado. */}
              {/* Ocasião e reproduções na MESMA linha: o cartão tem 128px
                  e cada linha nova empurra a grade inteira pra baixo. A
                  contagem é curta e alinha à direita, então cabe sem
                  disputar espaço com a ocasião, que trunca.
                  Sem reprodução nenhuma o número não aparece — "0" em toda
                  a grade seria ruído, não informação. */}
              <div className="flex items-baseline gap-1.5">
                <p className="text-[11px] text-white/40 truncate flex-1 min-w-0">{it.occasion}</p>
                {(it.plays ?? 0) > 0 && (
                  <span className="text-[11px] text-white/30 tabular-nums shrink-0"
                        title={`${it.plays} reproduç${it.plays === 1 ? "ão" : "ões"}`}>
                    ▶ {formatarPlays(it.plays ?? 0)}
                  </span>
                )}
              </div>
              {/* Sem apelido o cartão ficava com essa linha VAZIA, e a
                  ausência lia como defeito ("não vi o nome de quem
                  publicou" — Audrei, 2026-09-02). Hoje é o esperado: só 1
                  perfil no sistema inteiro preencheu apelido e ligou o
                  opt-in, e as músicas desse perfil são justamente as que a
                  Rede esconde de quem é o dono delas.
                  O rótulo neutro torna o estado legível SEM revelar
                  identidade — publication_consent autoriza publicar a obra,
                  não expor quem encomendou. */}
              <p className={`text-[11px] truncate ${it.authorApelido ? "text-white/55" : "text-white/25 italic"}`}
                 title={it.authorApelido ?? "Este autor não escolheu aparecer na Rede"}>
                {it.authorApelido ?? "Membro da Rede"}
              </p>
            </div>
          )
        })}
      </div>

      {/* Paginação. A Rede vem em páginas de 40 do servidor.
          O botão sozinho não bastava: no celular são 40 cartões de rolagem
          até chegar nele, e o Audrei relatou "não estou vendo paginação no
          mobile e nem todas as músicas aparecem" — ele nunca chegou ao fim
          da lista. Agora a próxima página entra sozinha quando a sentinela
          abaixo se aproxima da tela (400px antes, pra a lista já estar
          pronta quando o dedo chegar lá).
          O botão CONTINUA como alternativa: se o observer não disparar
          (aba em segundo plano, navegador antigo, alguém que rola muito
          rápido), ainda dá pra pedir a próxima página no clique. */}
      <div ref={sentinelaRef} aria-hidden="true" className="h-px" />

      {temMais && (
        <div className="flex justify-center mt-5">
          <button
            onClick={carregarMais}
            disabled={carregando}
            className="px-6 py-2.5 rounded-full text-sm font-semibold border border-white/15 text-white/70 hover:text-white hover:border-white/35 disabled:opacity-50 transition-colors"
          >
            {carregando ? "Carregando…" : `Mostrar mais (${total - itensBusca.length} restantes)`}
          </button>
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
