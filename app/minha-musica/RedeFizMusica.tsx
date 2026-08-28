"use client"

import { useEffect, useState } from "react"
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

export default function RedeFizMusica({ onPlaylistsChanged, onPrecisaLogin }: { onPlaylistsChanged?: () => void; onPrecisaLogin?: () => void }) {
  const { items, alternarFavorito, temMais, carregando, carregarMais, total } = useCatalogo()
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
  const itensBusca = items ?? []

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
                      onClick={() => playOuPausa({ id: it.orderId, title: it.title, occasion: it.occasion, audioUrl: it.audioUrl, imageUrl: it.imageUrl, lyrics: it.lyrics ?? null, lyricsLrc: it.lyricsLrc ?? null, apelido: it.authorApelido })}
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
                  onClick={() => playOuPausa({ id: it.orderId, title: it.title, occasion: it.occasion, audioUrl: it.audioUrl, imageUrl: it.imageUrl, lyrics: it.lyrics ?? null, lyricsLrc: it.lyricsLrc ?? null, apelido: it.authorApelido })}
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
              <p className="text-[11px] text-white/40 truncate">{it.occasion}</p>
            </div>
          )
        })}
      </div>

      {/* Paginação: a Rede vem em páginas de 40 do servidor. Sem este botão o
          cliente veria só as 40 primeiras e não teria como chegar no resto. */}
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
