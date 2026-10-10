"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "@/lib/supabase"
import { gradienteDaCapa } from "@/lib/capaGradiente"
import InfoTooltip from "./InfoTooltip"
import PublicacaoConsent from "./PublicacaoConsent"
import { useToast } from "./ToastContext"
import { usePlayer, type PlayableTrack } from "./PlayerContext"
import type { LibraryTrack } from "./MinhasMusicas"
import { confirmar } from "@/app/components/Dialogo"

// "Minhas músicas publicadas" — aba Músicas, só para quem está logado
// (a aba do visitante nem monta este componente). Fecha o gancho do texto da
// Carreira: cada música que você lança na Rede é ouvida e aplaudida, e aqui
// você acompanha o desempenho dela e decide se ela fica na Rede.
//
// Publicar passa pelo MESMO texto de autorização do pedido
// (PublicacaoConsent): é consentimento com valor legal, não um interruptor.
// Tirar da Rede é direto, com confirmação. Música oculta pela equipe (após
// denúncia, `rede_oculta`) não pode ser republicada por aqui.

type Musica = {
  orderId: string
  titulo: string
  imageUrl: string | null
  situacao: "publicada" | "privada" | "oculta"
  palmas: number
  reproducoes: number
  reproducoesMes: number
  posReproducoes: number | null
  posTop: number | null
  faltamParaTop10: number | null
}

const fmt = (n: number) => n.toLocaleString("pt-BR")

// `biblioteca`: as músicas do cliente que a aba já montou (page.tsx), com
// áudio, letra e capa — a capa do cartão toca a partir delas, igual à
// "Minha playlist". Não busca o áudio de novo.
export default function MinhasPublicadas({ biblioteca = [], meuApelido = null }: { biblioteca?: LibraryTrack[]; meuApelido?: string | null }) {
  const { track: tocando, playing, playOuPausa } = usePlayer()
  const [musicas, setMusicas] = useState<Musica[] | null>(null)
  const [totalNaRede, setTotalNaRede] = useState(0)
  const [publicando, setPublicando] = useState<Musica | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)
  const { showToast } = useToast()

  const carregar = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setMusicas([]); return }
      const r = await fetch("/api/minhas-musicas/desempenho", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then((x) => x.json())
      setMusicas(r.musicas ?? [])
      setTotalNaRede(r.totalNaRede ?? 0)
    } catch {
      setMusicas((m) => m ?? [])
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function tirarDaRede(m: Musica) {
    if (!(await confirmar({
      titulo: `Tirar “${m.titulo}” da Rede?`,
      mensagem: "Ela some da Rede e o link público para de funcionar. Você pode publicar de novo quando quiser.",
      botao: "Tirar da Rede",
      perigo: true,
    }))) return
    setSalvando(m.orderId)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/orders/${m.orderId}/publicacao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ consent: false }),
    })
    setSalvando(null)
    if (!res.ok) { showToast("Não foi possível tirar da Rede. Tente de novo."); return }
    showToast("Música tirada da Rede.")
    carregar()
  }

  if (musicas === null) return null

  // Fila = as músicas desta fileira que têm áudio, na mesma ordem.
  const porId = new Map(biblioteca.map((t) => [t.id, t]))
  const paraTocar = (t: LibraryTrack): PlayableTrack => ({
    id: t.id, title: t.title, occasion: t.occasion, audioUrl: t.audioUrl as string,
    imageUrl: t.imageUrl, lyrics: t.lyrics, lyricsLrc: t.lyricsLrc,
    apelido: meuApelido, publico: !!t.publico, minha: true,
  })
  const fila = musicas.map((m) => porId.get(m.orderId)).filter((t): t is LibraryTrack => !!t?.audioUrl).map(paraTocar)

  return (
    <div className="mb-9">
      <div className="flex items-center gap-2.5 mb-1">
        <h2 className="text-xl font-bold flex-1 min-w-0 truncate">Minhas músicas publicadas</h2>
        <InfoTooltip text="Publique suas músicas na Rede Fiz Música para outras pessoas ouvirem e aplaudirem. Aqui você acompanha as palmas, as reproduções e a posição de cada uma no ranking." />
      </div>

      {musicas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-5 py-6 text-center">
          <p className="text-sm text-white/70">Você ainda não tem música para publicar.</p>
          <p className="text-sm text-white/45 mt-1">Quando a sua música ficar pronta, ela aparece aqui e você decide se ela vai para a Rede.</p>
          <a href="/criar" className="inline-block mt-4 px-4 py-2 rounded-full text-sm font-bold text-white"
             style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
            Criar minha música
          </a>
        </div>
      ) : (
        <>
          <p className="text-sm text-white/50 mb-4">
            {musicas.filter((m) => m.situacao === "publicada").length} de {musicas.length} na Rede
            <span className="text-white/35"> · {fmt(totalNaRede)} músicas na Rede ao todo</span>
          </p>
          <div className="flex gap-3.5 overflow-x-auto pb-2 -mx-5 sm:mx-0 px-5 sm:px-0">
            {musicas.map((m) => (
              <div key={m.orderId} className="shrink-0 w-44 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 flex flex-col">
                <div className="relative w-full aspect-square rounded-xl bg-cover bg-center"
                     style={{ background: m.imageUrl ? `url(${m.imageUrl}) center/cover` : gradienteDaCapa(m.orderId) }}>
                  {(() => {
                    const t = porId.get(m.orderId)
                    if (!t?.audioUrl) return null
                    const estaTocando = tocando?.id === m.orderId && playing
                    return (
                      <button type="button" onClick={() => playOuPausa(paraTocar(t), fila)}
                              aria-label={estaTocando ? `Pausar ${m.titulo}` : `Ouvir ${m.titulo}`}
                              className="absolute inset-0 flex items-center justify-center rounded-xl group">
                        <span className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-base backdrop-blur transition-transform group-hover:scale-110 ${
                          estaTocando ? "bg-fuchsia-500/90" : "bg-black/45"
                        }`}>
                          {estaTocando ? "❚❚" : "▶"}
                        </span>
                      </button>
                    )
                  })()}
                  {m.situacao === "publicada" && m.posTop !== null && m.posTop <= 10 && (
                    <span className="absolute top-1.5 left-1.5 text-[13px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-950">
                      🏆 #{m.posTop} no Top 10
                    </span>
                  )}
                </div>
                <p className={`text-sm font-semibold mt-2 truncate ${tocando?.id === m.orderId && playing ? "text-fuchsia-300" : ""}`} title={m.titulo}>{m.titulo}</p>

                <p className={`text-[11px] uppercase tracking-wide font-bold mt-1 ${
                  m.situacao === "publicada" ? "text-green-300" : m.situacao === "oculta" ? "text-orange-300" : "text-white/40"
                }`}>
                  {m.situacao === "publicada" ? "🌐 Na Rede" : m.situacao === "oculta" ? "🙈 Tirada pela equipe" : "🔒 Só você"}
                </p>

                {m.situacao === "publicada" && (
                  <div className="mt-2 space-y-1 text-[13px] text-white/70">
                    <p>👏 <strong className="text-white">{fmt(m.palmas)}</strong> {m.palmas === 1 ? "palma" : "palmas"}</p>
                    <p>▶ <strong className="text-white">{fmt(m.reproducoes)}</strong> {m.reproducoes === 1 ? "reprodução" : "reproduções"}</p>
                    {m.posReproducoes !== null ? (
                      <p className="text-white/55">#{m.posReproducoes} de {fmt(totalNaRede)} em reproduções</p>
                    ) : (
                      <p className="text-white/40">Ainda sem reproduções — compartilhe!</p>
                    )}
                    {m.posTop !== null && m.posTop > 10 && (
                      <p className="text-white/55">
                        #{m.posTop} no ranking do mês
                        {m.faltamParaTop10 !== null && (
                          <span className="text-white/40"> · faltam {fmt(m.faltamParaTop10)} para o Top 10</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
                {m.situacao === "privada" && (
                  <p className="mt-2 text-[13px] text-white/45 leading-snug">Publique para outras pessoas ouvirem e aplaudirem.</p>
                )}
                {m.situacao === "oculta" && (
                  <p className="mt-2 text-[13px] text-white/45 leading-snug">
                    A equipe tirou esta música da Rede após uma denúncia. Dúvidas: contato@fizmusica.com.br
                  </p>
                )}

                <div className="mt-auto pt-3">
                  {m.situacao === "publicada" && (
                    <button type="button" disabled={salvando === m.orderId} onClick={() => tirarDaRede(m)}
                            className="w-full py-2 rounded-xl text-[13px] font-semibold border border-white/15 text-white/70 hover:text-white hover:border-white/35 disabled:opacity-40">
                      Tirar da Rede
                    </button>
                  )}
                  {m.situacao === "privada" && (
                    <button type="button" onClick={() => setPublicando(m)}
                            className="w-full py-2 rounded-xl text-[13px] font-bold text-white"
                            style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
                      Publicar na Rede
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Publicar = o termo de autorização inteiro, o mesmo do pedido.
          Fecha sozinho quando a pessoa marca a autorização e ela é salva. */}
      {publicando && typeof document !== "undefined" && createPortal(
        <div className="fm-popup-fundo fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 text-white"
             onClick={() => setPublicando(null)}>
          <div className="fm-popup w-full max-w-md rounded-2xl border border-white/10 bg-[#15111f] p-4 max-h-[90dvh] overflow-y-auto"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm truncate">Publicar “{publicando.titulo}”</p>
              <button onClick={() => setPublicando(null)} className="text-white/40 hover:text-white text-lg leading-none" aria-label="Fechar">✕</button>
            </div>
            <PublicacaoConsent
              orderId={publicando.orderId}
              initial={false}
              onChange={(ok) => {
                if (!ok) return
                setPublicando(null)
                showToast("💜 Música publicada na Rede!")
                carregar()
              }}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
