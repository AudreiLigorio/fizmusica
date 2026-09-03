"use client"

import { useEffect, useState } from "react"
import { usePlayer } from "./PlayerContext"
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

export default function ResultadosBusca({
  minhas = [],
  meuApelido = null,
}: {
  minhas?: LibraryTrack[]
  meuApelido?: string | null
}) {
  const { items: rede, busca, filtro, temMais, carregando, carregarMais } = useCatalogo()
  const { track: nowPlaying, playing, playOuPausa } = usePlayer()

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
        <p className="text-white/35 text-xs mt-1.5">Tente por ocasião (natal, aniversário) ou estilo (rock, pop).</p>
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
            <button
              key={l.id}
              type="button"
              onClick={() => playOuPausa(
                {
                  id: l.id, title: l.title, occasion: l.occasion, audioUrl: l.audioUrl,
                  imageUrl: l.imageUrl, lyrics: l.lyrics, lyricsLrc: l.lyricsLrc, apelido: l.apelido,
                },
                // Fila = o resultado da busca, na ordem em que está na tela.
                linhas.map((x) => ({
                  id: x.id, title: x.title, occasion: x.occasion, audioUrl: x.audioUrl,
                  imageUrl: x.imageUrl, lyrics: x.lyrics, lyricsLrc: x.lyricsLrc, apelido: x.apelido,
                })),
              )}
              className="w-full flex items-center gap-3.5 px-1 py-2 rounded-xl hover:bg-white/[0.04] transition-colors text-left"
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
                {tocando && <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-[11px]">❚❚</div>}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${tocando ? "text-fuchsia-300" : ""}`}>
                  <Realce texto={l.title} termo={busca} />
                </p>
                {/* Origem PRIMEIRO e curta ("Da Rede", não "Rede Fiz Música"):
                    a linha trunca no fim, e saber de quem é a música não pode
                    ser justo a parte cortada. Ocasião e estilo vêm depois —
                    se algo se perder, que seja o fim do estilo, que já aparece
                    destacado quando foi ele que casou com a busca. */}
                <p className="text-[11px] text-white/40 truncate mt-0.5">
                  <span className={l.minha ? "text-white/60" : "text-fuchsia-300/60"}>
                    {l.minha ? "Sua música" : "Da Rede"}
                  </span>
                  {contexto.map((c, i) => (
                    <span key={i}>
                      <span className="text-white/20"> · </span>
                      <Realce texto={c} termo={busca} />
                    </span>
                  ))}
                  {/* Apelido no fim, e só nas músicas de OUTRAS pessoas: em
                      "Sua música" o autor é quem está olhando. Nulo na maioria
                      dos casos — o apelido exige opt-in e só vem pra logado. */}
                  {!l.minha && l.apelido && (
                    <>
                      <span className="text-white/20"> | </span>
                      <span className="text-white/55">{l.apelido}</span>
                    </>
                  )}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Paginação: a Rede vem em páginas de 40 do servidor. Sem isso, um
          catálogo de milhares viria inteiro numa requisição só. */}
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
