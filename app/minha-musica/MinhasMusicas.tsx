"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePlayer } from "./PlayerContext"
import AddToPlaylistModal from "./AddToPlaylistModal"
import CreatePlaylistModal from "./CreatePlaylistModal"
import MinhasPlaylists from "./MinhasPlaylists"
import { useToast } from "./ToastContext"
import InfoTooltip from "./InfoTooltip"
import { combina } from "@/lib/busca"
import { gradienteDaCapa } from "@/lib/capaGradiente"

export type LibraryTrack = {
  id: string
  title: string
  occasion: string
  // A busca já procurava por estilo, mas o dado não vinha até aqui — então
  // buscar "rock" trazia a música e não mostrava por quê. Ver ResultadosBusca.
  musicalStyle: string | null
  slug: string
  imageUrl: string | null
  audioUrl: string | null
  lyrics: string | null
  lyricsLrc: string | null
}
type Playlist = { id: string; nome: string; track_order_ids: string[] }

// "Minhas músicas" não guarda nada de novo — é derivado dos pedidos entregues
// (prop `tracks`, montada em page.tsx a partir dos mesmos `orders` que a
// lista de pedidos já usa). Só a playlist (agrupamento) tem tabela própria.
export default function MinhasMusicas({ tracks: todasTracks, playlistsVersion, busca = "", meuApelido = null, onPlaylistsChanged, onContagem }: { tracks: LibraryTrack[]; playlistsVersion: number; busca?: string; meuApelido?: string | null; onPlaylistsChanged?: () => void; onContagem?: (n: number) => void }) {
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null)
  // Toque no "+" — o caminho que funciona em qualquer aparelho (arrastar é
  // só desktop; drag nativo HTML5 não existe em navegador mobile).
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null)
  // Criação de playlist: orderId fica pendente enquanto o modal de nome está
  // aberto — undefined quando a playlist nasce vazia (criada sem música,
  // pelo "Nova playlist" dentro do modal de adicionar).
  const [creatingPlaylistOpen, setCreatingPlaylistOpen] = useState(false)
  const [pendingOrderId, setPendingOrderId] = useState<string | undefined>(undefined)
  const { track: nowPlaying, playing, playOuPausa } = usePlayer()
  const { showToast } = useToast()

  // Campos da busca — lista pra crescer: quando existir apelido do autor,
  // entra mais um item aqui e o resto continua igual.
  const tracks = todasTracks.filter((t) => combina(busca, [t.title, t.occasion]))
  useEffect(() => { onContagem?.(tracks.length) }, [tracks.length, onContagem])

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" }
  }

  async function carregar() {
    const headers = await authHeaders()
    const res = await fetch("/api/playlists", { headers })
    const d = await res.json().catch(() => ({}))
    const lista: Playlist[] = d.playlists ?? []
    setPlaylists(lista)
    return lista
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function abrirAdicionar(trackId: string) {
    setAddingTrackId(trackId)
    // Recarrega antes de abrir — este cartão só busca playlists no mount,
    // então uma playlist criada na Rede Fiz Música (estado separado) não
    // apareceria aqui sem isso.
    carregar()
  }

  function abrirCriarPlaylist(orderId?: string) {
    setPendingOrderId(orderId)
    setCreatingPlaylistOpen(true)
  }

  async function confirmarCriarPlaylist(nome: string) {
    setCreatingPlaylistOpen(false)
    const headers = await authHeaders()
    await fetch("/api/playlists", { method: "POST", headers, body: JSON.stringify({ nome, orderId: pendingOrderId }) })
    await carregar()
    onPlaylistsChanged?.()
    // Só o toast: a raia logo abaixo já mostra o resultado, abrir um modal por
    // cima obrigava a fechar algo que o cliente não pediu.
    showToast("Adicionado com sucesso ✓")
  }

  async function adicionar(playlistId: string, orderId: string) {
    const headers = await authHeaders()
    await fetch(`/api/playlists/${playlistId}`, { method: "PATCH", headers, body: JSON.stringify({ addOrderId: orderId }) })
    await carregar()
    onPlaylistsChanged?.()
    showToast("Adicionado com sucesso ✓")
  }

  // Some só quando a BUSCA não achou nada aqui — a contagem geral já explica
  // o vazio, e duas prateleiras vazias ficariam confusas.
  //
  // Cliente SEM música nenhuma NÃO some mais: o botão "Nova playlist" e as
  // playlists existentes moram nesta seção, então quem ainda não comprou
  // ficava sem nenhum caminho pra criar playlist — mesmo podendo montá-la
  // com músicas da Rede. O visitante deslogado via "Minha playlist" e o
  // cliente logado não via: invertido.
  const semMusicaPropria = todasTracks.length === 0
  if (!semMusicaPropria && tracks.length === 0) return null

  return (
    <div className="mb-9">
      {/* Sem card/borda de propósito: no lugar da moldura, o título grande em
          serifa é quem separa esta seção da próxima — mesma lógica do
          Spotify. Capas maiores (w-32) e coladas na borda, "mais expandido". */}
      <div className="flex items-center gap-2.5 mb-1">
        <h2 className="text-xl font-bold flex-1 min-w-0 truncate">Minha playlist</h2>
        <InfoTooltip text="Suas músicas entram aqui automaticamente quando ficam prontas. Você também pode juntar músicas da Rede Fiz Música tocando no + de cada capa." />
      </div>
      {/* Pra quem ainda não tem música, o texto põe a MÚSICA DELE em primeiro
          lugar e a Rede como complemento. A versão anterior falava só da Rede
          e, sem querer, ensinava que a playlist é pra colecionar música dos
          outros — o oposto do que o produto quer. */}
      <p className="text-xs text-white/50 mb-4">
        {semMusicaPropria
          ? "Aqui ficam as músicas que você criar — e você ainda pode juntar as da Rede tocando no +. Faça a sua música, monte a sua playlist."
          : "Suas músicas ficam aqui. Toque no + para juntar também as da Rede e montar a playlist do seu jeito."}
      </p>

      <div className={`flex gap-3.5 overflow-x-auto sm:flex-wrap sm:overflow-x-visible pb-2 -mx-5 sm:mx-0 px-5 sm:px-0 ${semMusicaPropria ? "" : "mb-5"}`}>
        {tracks.map((t) => {
          const isPlaying = nowPlaying?.id === t.id && playing
          return (
            <div key={t.id} className="shrink-0 w-32 group">
              <div
                className="relative w-32 h-32 rounded-xl bg-cover bg-center"
                style={{ background: t.imageUrl ? `url(${t.imageUrl}) center/cover` : gradienteDaCapa(t.id) }}
              >
                <button
                  type="button"
                  disabled={!t.audioUrl}
                  onClick={() => t.audioUrl && playOuPausa(
                    { id: t.id, title: t.title, occasion: t.occasion, audioUrl: t.audioUrl, imageUrl: t.imageUrl, lyrics: t.lyrics, lyricsLrc: t.lyricsLrc, apelido: meuApelido },
                    // Fila = a biblioteca inteira, sem as que ainda não têm
                    // áudio (pedido em produção): elas travariam a emenda.
                    tracks.filter((x) => x.audioUrl).map((x) => ({
                      id: x.id, title: x.title, occasion: x.occasion,
                      audioUrl: x.audioUrl as string, imageUrl: x.imageUrl,
                      lyrics: x.lyrics, lyricsLrc: x.lyricsLrc, apelido: meuApelido,
                    })),
                  )}
                  className="absolute inset-0 flex items-center justify-center text-2xl disabled:cursor-default"
                >
                  {!t.imageUrl && "▶"}
                  {isPlaying && <div className="absolute inset-0 bg-black/35 rounded-xl flex items-center justify-center text-xl">❚❚</div>}
                </button>
                <button
                  type="button"
                  onClick={() => abrirAdicionar(t.id)}
                  aria-label="Adicionar à playlist"
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-xs font-bold hover:scale-110 transition-transform"
                >
                  +
                </button>
              </div>
              <p className={`text-xs font-medium mt-2 truncate transition-colors ${isPlaying ? "text-fuchsia-300" : "group-hover:text-fuchsia-300"}`}>{t.title}</p>
            </div>
          )
        })}
      </div>

      {/* Sem rótulo aqui: o título da seção já é "Minha Playlist", repetir
          duas vezes na mesma tela só polui. */}
      <div className="flex items-center justify-end mb-1.5">
        <button
          type="button"
          onClick={() => abrirCriarPlaylist()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-white/15 text-white/50 hover:text-white hover:border-fuchsia-500/40 text-[11px] font-medium transition-colors"
        >
          <span className="text-xs">➕</span>
          Nova playlist
        </button>
      </div>

      <MinhasPlaylists version={playlistsVersion} embedded busca={busca} />

      <AddToPlaylistModal
        open={!!addingTrackId}
        playlists={playlists}
        onClose={() => setAddingTrackId(null)}
        onAdd={(playlistId) => { if (addingTrackId) adicionar(playlistId, addingTrackId) }}
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
