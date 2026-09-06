"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePlayer } from "./PlayerContext"
import { useToast } from "./ToastContext"
import { combina } from "@/lib/busca"
import { gradienteDaCapa } from "@/lib/capaGradiente"

type Track = { orderId: string; title: string; occasion: string; imageUrl: string | null; audioUrl: string; apelido: string | null }
type PlaylistFull = { id: string; nome: string; tracks: Track[] }

// Uma raia por playlist, sempre visível na tela (em vez de só um card que
// abre modal) — pra criar músicas seja tão simples quanto tocar no + de
// qualquer faixa (Minhas Músicas ou Rede Fiz Música) e ver o resultado
// direto aqui embaixo. `version` sobe toda vez que qualquer um dos dois
// cartões cria/altera uma playlist, disparando o recarregamento.
export default function MinhasPlaylists({ version, embedded, busca = "" }: { version: number; embedded?: boolean; busca?: string }) {
  const [playlists, setPlaylists] = useState<PlaylistFull[] | null>(null)
  const { track: nowPlaying, playing, playOuPausa } = usePlayer()
  const { showToast } = useToast()

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ""}` }
  }

  // Erro visto em produção (Sentry, 06/09): `TypeError: Failed to fetch`
  // aqui dentro. O `.json().catch()` protegia a LEITURA da resposta, mas o
  // `fetch` em si não estava protegido — e é ele que rejeita quando a rede
  // cai, a pessoa troca de aba no meio ou sai um deploy durante a chamada.
  // Como `carregar()` roda solto num useEffect, a rejeição não tinha quem a
  // pegasse e virava erro não tratado.
  //
  // O `Promise.all` era o segundo problema, mais grave que o primeiro: UMA
  // playlist que falhasse derrubava TODAS. Como a tela esconde a seção
  // enquanto `playlists` é null, o cliente perdia a prateleira inteira por
  // causa de uma requisição — e sem nenhuma mensagem, porque some em
  // silêncio. `allSettled` isola: a que falhou entra vazia, as outras
  // aparecem.
  async function carregar() {
    try {
      const headers = await authHeaders()
      const listRes = await fetch("/api/playlists", { headers })
      const listData = await listRes.json().catch(() => ({}))
      const lista: { id: string; nome: string }[] = listData.playlists ?? []

      const resultados = await Promise.allSettled(
        lista.map(async (pl) => {
          const res = await fetch(`/api/playlists/${pl.id}`, { headers })
          const d = await res.json().catch(() => ({}))
          return { id: pl.id, nome: pl.nome, tracks: d.tracks ?? [] } as PlaylistFull
        })
      )
      setPlaylists(
        resultados.map((r, i) =>
          r.status === "fulfilled" ? r.value : { id: lista[i].id, nome: lista[i].nome, tracks: [] },
        ),
      )
    } catch {
      // Lista vazia, não null: null mantém a seção escondida pra sempre e a
      // tela fica sem explicar nada. Vazia deixa o resto da aba funcionar, e
      // a próxima montagem tenta de novo.
      setPlaylists([])
    }
  }

  useEffect(() => { carregar() }, [version]) // eslint-disable-line react-hooks/exhaustive-deps

  async function remover(playlistId: string, orderId: string) {
    // Otimista: some da raia na hora, sem esperar o servidor.
    setPlaylists((prev) => prev?.map((pl) => (pl.id === playlistId ? { ...pl, tracks: pl.tracks.filter((t) => t.orderId !== orderId) } : pl)) ?? null)
    const headers = await authHeaders()
    await fetch(`/api/playlists/${playlistId}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ removeOrderId: orderId }) })
    showToast("Excluído com sucesso ✓")
  }

  async function excluirPlaylist(playlistId: string, nome: string) {
    if (!window.confirm(`Excluir a playlist "${nome}"? Isso não apaga as músicas, só a coleção.`)) return
    setPlaylists((prev) => prev?.filter((pl) => pl.id !== playlistId) ?? null) // otimista
    const headers = await authHeaders()
    await fetch(`/api/playlists/${playlistId}`, { method: "DELETE", headers })
    showToast("Excluído com sucesso ✓")
  }

  if (!playlists || playlists.length === 0) return null

  // Durante a busca, cada raia mostra só o que combina e some se não sobrar
  // nada — o nome da playlist também conta como campo, pra "favoritas" achar
  // a playlist inteira.
  const visiveis = !busca.trim()
    ? playlists
    : playlists
        .map((pl) => (combina(busca, [pl.nome]) ? pl : { ...pl, tracks: pl.tracks.filter((t) => combina(busca, [t.title, t.occasion])) }))
        .filter((pl) => pl.tracks.length > 0)

  if (visiveis.length === 0) return null

  return (
    <>
      {visiveis.map((pl) => (
        <div
          key={pl.id}
          className={embedded ? "mt-6 pt-5 border-t border-white/5" : "mb-9"}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-bold min-w-0 truncate">{pl.nome}</h2>
            <button
              type="button"
              onClick={() => excluirPlaylist(pl.id, pl.nome)}
              aria-label="Excluir playlist"
              className="shrink-0 w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-xs font-bold text-white/70 hover:scale-110 hover:bg-red-500/70 hover:text-white transition-all"
            >
              −
            </button>
          </div>

          {pl.tracks.length === 0 ? (
            <p className="text-xs text-white/40 leading-relaxed">
              Clique no + de uma música na Rede Fiz Música e adicione músicas aqui.
            </p>
          ) : (
            <div className="flex gap-3.5 overflow-x-auto sm:flex-wrap sm:overflow-x-visible pb-2 -mx-5 sm:mx-0 px-5 sm:px-0">
              {pl.tracks.map((t) => {
                const isPlaying = nowPlaying?.id === t.orderId && playing
                return (
                  <div key={t.orderId} className="shrink-0 w-32 group">
                    <div
                      className="relative w-32 h-32 rounded-xl overflow-hidden"
                      style={{ background: gradienteDaCapa(t.orderId) }}
                    >
                      {t.imageUrl && (
                        // <img> em vez de background-image: se a capa falhar
                        // ao carregar, some sozinha e deixa o gradiente atrás
                        // aparecer — sem isso ficava preto sólido e ilegível.
                        <img
                          src={t.imageUrl}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = "none" }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => playOuPausa(
                          { id: t.orderId, title: t.title, occasion: t.occasion, audioUrl: t.audioUrl, imageUrl: t.imageUrl, lyrics: null, lyricsLrc: null, apelido: t.apelido },
                          // Fila = a playlist aberta, na ordem em que ela
                          // aparece — é o que a pessoa montou.
                          pl.tracks.map((x) => ({
                            id: x.orderId, title: x.title, occasion: x.occasion,
                            audioUrl: x.audioUrl, imageUrl: x.imageUrl,
                            lyrics: null, lyricsLrc: null, apelido: x.apelido,
                          })),
                        )}
                        className="absolute inset-0"
                        aria-label={isPlaying ? "Pausar" : "Tocar"}
                      >
                        {isPlaying && <div className="absolute inset-0 bg-black/35 flex items-center justify-center text-xl">❚❚</div>}
                      </button>
                      <button
                        type="button"
                        onClick={() => remover(pl.id, t.orderId)}
                        aria-label="Remover da playlist"
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-xs font-bold hover:scale-110 hover:bg-red-500/70 transition-all"
                      >
                        −
                      </button>
                    </div>
                    <p className={`text-xs font-medium mt-2 truncate transition-colors ${isPlaying ? "text-fuchsia-300" : "group-hover:text-fuchsia-300"}`}>{t.title}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </>
  )
}
