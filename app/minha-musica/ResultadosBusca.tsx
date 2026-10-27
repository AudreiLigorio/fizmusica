"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePlayer } from "./PlayerContext"
import AddToPlaylistModal from "./AddToPlaylistModal"
import CreatePlaylistModal from "./CreatePlaylistModal"
import { useToast } from "./ToastContext"
import { combina, normalizar } from "@/lib/busca"
import { gradienteDaCapa } from "@/lib/capaGradiente"
import type { LibraryTrack } from "./MinhasMusicas"
import type { Unificada as Linha } from "./CatalogoContext"
import { useCatalogo, mesclar, casaFiltroCliente } from "./CatalogoContext"

// Modo resultado da aba Músicas.
//
// Sem busca, a tela é de NAVEGAÇÃO: raias da Rede, playlists, capas grandes.
// Com busca, ela vira RESULTADO: as seções somem e sobra uma lista única.
// Antes a busca filtrava as raias no lugar, então procurar "natal" deixava
// uma capinha solta em "Minhas Músicas" e outra na Rede, cada uma no meio do
// título e das bordas da sua seção — o resultado tinha que ser caçado dentro
// do layout de navegação.
//
// Cada linha carrega o CONTEXTO que casou (ocasião · estilo · origem), com o
// trecho digitado destacado. Sem isso, buscar "rock" devolvia uma capa sem
// nenhuma pista do porquê: o estilo é campo de busca desde sempre, mas nunca
// era mostrado em lugar nenhum.

// Acende no texto o trecho que o cliente digitou. Compara sem acento (a busca
// também ignora), mas recorta em cima do texto ORIGINAL — senão a tela
// mostraria "ocasiao" no lugar de "ocasião".
function Realce({ texto, termo }: { texto: string; termo: string }) {
  const alvo = normalizar(texto)
  const partes = normalizar(termo).split(/\s+/).filter(Boolean)
  // Marca quais posições do texto pertencem a alguma palavra buscada.
  const marcado = new Array(texto.length).fill(false)
  for (const p of partes) {
    let de = alvo.indexOf(p)
    while (de !== -1) {
      for (let i = de; i < de + p.length && i < marcado.length; i++) marcado[i] = true
      de = alvo.indexOf(p, de + p.length)
    }
  }
  if (!marcado.some(Boolean)) return <>{texto}</>

  // Agrupa em blocos contínuos pra não gerar um <span> por letra.
  const blocos: { txt: string; on: boolean }[] = []
  for (let i = 0; i < texto.length; i++) {
    const on = marcado[i]
    const ultimo = blocos[blocos.length - 1]
    if (ultimo && ultimo.on === on) ultimo.txt += texto[i]
    else blocos.push({ txt: texto[i], on })
  }
  return (
    <>
      {blocos.map((b, i) =>
        b.on ? <span key={i} className="text-fuchsia-300 font-semibold">{b.txt}</span> : <span key={i}>{b.txt}</span>
      )}
    </>
  )
}

type Playlist = { id: string; nome: string; track_order_ids: string[] }

export default function ResultadosBusca({
  minhas = [],
  meuApelido = null,
  onPlaylistsChanged,
  onPrecisaLogin,
}: {
  minhas?: LibraryTrack[]
  meuApelido?: string | null
  onPlaylistsChanged?: () => void
  onPrecisaLogin?: () => void
}) {
  const { items: rede, busca, filtro, temMais, carregando, carregarMais, alternarFavorito } = useCatalogo()
  const { track: nowPlaying, playing, playOuPausa } = usePlayer()
  const { showToast } = useToast()

  // Favoritar e montar playlist DIRETO na linha.
  //
  // Antes só dava pra fazer as duas coisas dentro do player: era preciso tocar
  // a música, esperar o player abrir e só então achar os botões. Numa lista de
  // 21 resultados de um ritmo, guardar três músicas custava abrir três vezes.
  //
  // O código espelha o de RedeFizMusica (mesmo fluxo, mesmos modais). É a
  // QUARTA cópia no projeto — MiniPlayer e MinhasMusicas têm as suas —, e
  // unificar as quatro num hook é dívida anotada, não feita aqui: as outras
  // três funcionam e ficam atrás do login, onde eu não consigo testar.
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null)
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null)
  const [creatingPlaylistOpen, setCreatingPlaylistOpen] = useState(false)
  const [pendingOrderId, setPendingOrderId] = useState<string | undefined>(undefined)

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" }
  }

  async function carregarPlaylists() {
    try {
      const res = await fetch("/api/playlists", { headers: await authHeaders() })
      const d = await res.json().catch(() => ({}))
      const lista: Playlist[] = d.playlists ?? []
      setPlaylists(lista)
      return lista
    } catch {
      setPlaylists([])
      return [] as Playlist[]
    }
  }

  async function abrirAdicionar(orderId: string) {
    // Sem conta o botão CONVIDA em vez de sumir — mesma regra da Rede.
    if (onPrecisaLogin) { onPrecisaLogin(); return }
    const lista = await carregarPlaylists()
    // Uma playlist só? Adiciona direto: o popup de escolher só faz sentido
    // quando há de fato uma escolha.
    if (lista.length === 1) adicionarNaPlaylist(lista[0].id, orderId)
    else setAddingTrackId(orderId)
  }

  async function adicionarNaPlaylist(playlistId: string, orderId: string) {
    await fetch(`/api/playlists/${playlistId}`, {
      method: "PATCH", headers: await authHeaders(), body: JSON.stringify({ addOrderId: orderId }),
    })
    await carregarPlaylists()
    onPlaylistsChanged?.()
    showToast("Adicionado com sucesso ✓")
  }

  async function confirmarCriarPlaylist(nome: string) {
    setCreatingPlaylistOpen(false)
    const res = await fetch("/api/playlists", {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ nome, orderId: pendingOrderId }),
    })
    if (!res.ok) { const j = await res.json().catch(() => ({})); showToast(j.error ?? "Não foi possível criar a playlist."); return }
    await carregarPlaylists()
    onPlaylistsChanged?.()
    showToast("Adicionado com sucesso ✓")
  }

  async function favoritar(orderId: string) {
    if (onPrecisaLogin) { onPrecisaLogin(); return }
    // Otimista: o contexto alterna e a lista reflete na hora — `linhas` sai de
    // `items`, então o coração acompanha sem esperar o servidor.
    alternarFavorito(orderId)
    await fetch("/api/catalog/favorite", {
      method: "POST", headers: await authHeaders(), body: JSON.stringify({ orderId }),
    }).catch(() => {})
  }

  // As músicas da REDE já vêm buscadas e filtradas do servidor (desde a
  // paginação) — refiltrar aqui esconderia resultado válido. Só as do
  // cliente são filtradas na tela, porque estão todas carregadas.
  const minhasFiltradas = minhas.filter(
    (t) => casaFiltroCliente(t.occasion, t.musicalStyle, filtro)
      && combina(busca, [t.title, t.occasion, t.musicalStyle]),
  )
  const linhas: Linha[] = mesclar(minhasFiltradas, rede, meuApelido)

  if (rede === null) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-7 h-7 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (linhas.length === 0) {
    return (
      <div className="text-center py-14">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-white/70 text-sm">
          {busca.trim()
            ? <>Nada encontrado para <span className="text-white font-medium">“{busca}”</span>.</>
            : "Nada nesse filtro."}
        </p>
        <p className="text-white/35 text-sm mt-1.5">Tente por ocasião (natal, aniversário) ou estilo (rock, pop).</p>
      </div>
    )
  }

  return (
    <div className="mb-9">
      <div className="space-y-1">
        {linhas.map((l) => {
          const tocando = nowPlaying?.id === l.id && playing
          // Ocasião · estilo · origem: é o contexto inteiro pelo qual a busca
          // procura, então é o que precisa aparecer pra explicar o resultado.
          const contexto = [l.occasion, l.musicalStyle].filter(Boolean) as string[]
          return (
            // Linha = DIV, não <button>.
            // Favoritar e "+" são botões, e botão dentro de botão é HTML
            // inválido: o clique de dentro dispararia o de fora e tocaria a
            // música a cada tentativa de guardar. Mesma razão das capinhas.
            <div
              key={l.id}
              className="w-full flex items-center gap-2 px-1 py-2 rounded-xl hover:bg-white/[0.04] transition-colors"
            >
            <button
              type="button"
              className="flex items-center gap-3.5 flex-1 min-w-0 text-left"
              onClick={() => playOuPausa(
                {
                  id: l.id, title: l.title, occasion: l.occasion, audioUrl: l.audioUrl,
                  imageUrl: l.imageUrl, lyrics: l.lyrics, lyricsLrc: l.lyricsLrc, apelido: l.apelido,
                  // Sem estes dois o player não sabe se a faixa tem endereço
                  // público, e os botões de favoritar e compartilhar somem.
                  publico: l.publico, minha: l.minha,
                },
                // Fila = o resultado da busca, na ordem em que está na tela.
                linhas.map((x) => ({
                  id: x.id, title: x.title, occasion: x.occasion, audioUrl: x.audioUrl,
                  imageUrl: x.imageUrl, lyrics: x.lyrics, lyricsLrc: x.lyricsLrc, apelido: x.apelido,
                  publico: x.publico, minha: x.minha,
                })),
              )}
            >
              {/* Gradiente SEMPRE por baixo da foto (duas camadas de
                  background-image, a primeira em cima). Capas antigas apontam
                  pra tempfile.aiquickdraw.com, que expira — sem a camada de
                  baixo a linha fica com um quadrado preto no lugar da capa. */}
              <div
                className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-cover bg-center"
                style={{
                  backgroundImage: l.imageUrl
                    ? `url(${l.imageUrl}), ${gradienteDaCapa(l.id)}`
                    : gradienteDaCapa(l.id),
                }}
              >
                {tocando && <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-[13px]">❚❚</div>}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${tocando ? "text-fuchsia-300" : ""}`}>
                  <Realce texto={l.title} termo={busca} />
                </p>
                {/* Quem publicou PRIMEIRO: a linha trunca no fim, e saber de
                    quem é a música não pode ser justo a parte cortada. Ocasião
                    e estilo vêm depois — se algo se perder, que seja o fim do
                    estilo, que já aparece destacado quando foi ele que casou
                    com a busca.
                    O nome substituiu o rótulo "Da Rede": ele diz a mesma coisa
                    (não é sua) e diz mais. Nas suas músicas continua "Sua
                    música", que é a distinção que importa na busca. */}
                <p className="text-[13px] text-white/40 truncate mt-0.5">
                  <span className={l.minha ? "text-white/60" : l.apelido ? "text-fuchsia-300/70" : "text-fuchsia-300/45 italic"}>
                    {l.minha ? "Sua música" : (l.apelido ?? "Membro da Rede")}
                  </span>
                  {contexto.map((c, i) => (
                    <span key={i}>
                      <span className="text-white/20"> · </span>
                      <Realce texto={c} termo={busca} />
                    </span>
                  ))}
                  {/* O apelido saía TAMBÉM aqui no fim. Desde que o nome
                      passou a abrir a linha (4995d2a), isso o repetia:
                      "Maurício · Composição autoral · 🎸 Rock | Maurício". */}
                </p>
              </div>
            </button>

            {/* Favoritar só nas músicas da REDE: as do próprio cliente não
                entram no catálogo, então não haveria o que favoritar — e o
                coração ficaria sempre apagado, parecendo defeito. */}
            <div className="flex items-center gap-1 shrink-0">
              {!l.minha && (
                <button
                  type="button"
                  onClick={() => favoritar(l.id)}
                  aria-label={l.favorited ? `Remover ${l.title} dos favoritos` : `Favoritar ${l.title}`}
                  title={l.favorited ? "Remover dos favoritos" : "Favoritar"}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm hover:bg-white/10 transition-colors"
                >
                  {l.favorited ? "❤️" : "🤍"}
                </button>
              )}
              {/* SEM `data-zona-escura`, ao contrário do "+" das capinhas: lá
                  ele fica SOBRE a capa, escura nos dois temas; aqui fica sobre
                  o fundo da página. Com a marca, o tema claro deixava de
                  converter o branco e o "+" sumia no branco — visto na tela. */}
              <button
                type="button"
                onClick={() => abrirAdicionar(l.id)}
                aria-label={`Adicionar ${l.title} a uma playlist`}
                title="Adicionar a uma playlist"
                className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold text-white/60 hover:bg-white/10 transition-colors"
              >
                +
              </button>
            </div>
            </div>
          )
        })}
      </div>

      {/* Paginação: a Rede vem em páginas de 40 do servidor. Sem isso, um
          catálogo de milhares viria inteiro numa requisição só. */}
      <AddToPlaylistModal
        open={!!addingTrackId}
        playlists={playlists}
        onClose={() => setAddingTrackId(null)}
        onAdd={(playlistId) => { if (addingTrackId) adicionarNaPlaylist(playlistId, addingTrackId) }}
        onCreateNew={() => { setPendingOrderId(addingTrackId ?? undefined); setCreatingPlaylistOpen(true) }}
      />
      <CreatePlaylistModal
        open={creatingPlaylistOpen}
        onClose={() => setCreatingPlaylistOpen(false)}
        onCreate={confirmarCriarPlaylist}
      />

      {temMais && (
        <div className="flex justify-center mt-6">
          <button
            onClick={carregarMais}
            disabled={carregando}
            className="px-6 py-2.5 rounded-full text-sm font-semibold border border-white/15 text-white/70 hover:text-white hover:border-white/35 disabled:opacity-50 transition-colors"
          >
            {carregando ? "Carregando…" : "Mostrar mais"}
          </button>
        </div>
      )}
    </div>
  )
}
