"use client"

import { useRef, useState } from "react"

/**
 * Carrossel de exemplos em VÍDEO — o player pronto dentro de um mockup de celular.
 * Cada card mostra uma capa (nome + música + ocasião + play) e, ao tocar, carrega
 * o MP4 vertical só naquele momento (preload="none") — leve em banda baixa.
 *
 * Os vídeos ficam em /public/videos/exemplos/<slug>.mp4 (até ~40s, 9:16, ~720x1280,
 * comprimidos pra 3–4MB). Enquanto um arquivo não existir, o card mostra "em breve"
 * em vez de quebrar. Novos exemplos: é só acrescentar um item em EXEMPLOS.
 */

type Exemplo = {
  slug: string
  nome: string
  musica: string
  ocasiao: string
  duracao: string
  grad: string
}

const EXEMPLOS: Exemplo[] = [
  { slug: "pamela",  nome: "Pamela",  musica: "Meu Melhor Talento",     ocasiao: "Pedido de namoro", duracao: "0:40", grad: "linear-gradient(155deg,#3d1533 0%,#c8447a 55%,#f3b26e 100%)" },
  { slug: "eduardo", nome: "Eduardo", musica: "O Farol do Meu Mundo",   ocasiao: "Dia dos Pais",     duracao: "0:40", grad: "linear-gradient(155deg,#12222f 0%,#3c6b74 48%,#e3b579 100%)" },
  { slug: "familia", nome: "Família", musica: "A Doce Espera de Beatriz", ocasiao: "Chá revelação",  duracao: "0:40", grad: "linear-gradient(135deg,#f7bcd8 0%,#ddc9f4 52%,#a8d3f0 100%)" },
  { slug: "orelha",  nome: "Orelha",  musica: "Estrela da Praia Brava",  ocasiao: "Homenagem Pet",   duracao: "4:28", grad: "linear-gradient(160deg,#241a33 0%,#6d5a94 48%,#d9b8d0 100%)" },
]

const BODY = { fontFamily: "'DM Sans', system-ui, sans-serif" }

export default function VideoExemplos() {
  const trackRef = useRef<HTMLUListElement>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const [errored, setErrored] = useState<Record<string, boolean>>({})

  function scrollByCard(dir: number) {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector<HTMLElement>("li")
    const w = card ? card.getBoundingClientRect().width + 24 : 280
    track.scrollBy({ left: dir * w, behavior: "smooth" })
  }

  return (
    <div style={BODY}>
      {/* Cabeçalho. Mesma fonte da vitrine de produtos (pedido do Audrei):
          DM Sans extrabold em caixa alta, quebrado na vírgula com a segunda
          linha no degradê rosa→roxo — igual ao título "Músicas que contam /
          histórias inesquecíveis" logo acima na página. Antes era a
          serifada (Cormorant) leve, com o selo "🎬 exemplos em vídeo" em
          cima; o selo saiu junto (pedido do Audrei). */}
      <div className="text-center mb-8">
        <h2 className="font-extrabold uppercase leading-[0.98] tracking-tight" style={BODY}>
          <span className="block text-white/90" style={{ fontSize: "clamp(1.7rem, 3.4vw, 2.5rem)" }}>
            A experiência pronta,
          </span>
          <span className="block" style={{ fontSize: "clamp(1.7rem, 3.4vw, 2.5rem)", background: "linear-gradient(90deg,#f0196b,#d946ef)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            na tela de quem recebe
          </span>
        </h2>
        <p className="text-white/50 text-sm mt-3">
          Toque para ver como cada música pode ser apresentado no celular. Além disso, você tem a opção de publicar a música na Rede.
        </p>
      </div>

      {/* Palco do carrossel */}
      <div className="relative">
        <button
          onClick={() => scrollByCard(-1)}
          aria-label="Exemplo anterior"
          className="hidden md:flex absolute left-[-0.5rem] top-[42%] -translate-y-1/2 z-10 w-11 h-11 rounded-full items-center justify-center text-2xl leading-none transition-colors"
          style={{ background: "rgba(18,15,28,0.85)", border: "1px solid rgba(255,255,255,0.14)", color: "#f5f3f7" }}
        >‹</button>

        <ul
          ref={trackRef}
          className="flex gap-6 list-none m-0 px-2 pb-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollPaddingInline: "0.5rem" }}
        >
          {EXEMPLOS.map((ex) => {
            const isPlaying = playing === ex.slug
            const isErrored = errored[ex.slug]
            return (
              <li key={ex.slug} className="snap-center shrink-0 w-[15.5rem] flex flex-col items-center">
                {/* Mockup de celular */}
                <div
                  className="relative w-full rounded-[2.35rem] p-2"
                  style={{
                    aspectRatio: "9 / 14.4",
                    background: "linear-gradient(155deg,#050507,#17141d)",
                    boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 30px 60px -25px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)",
                  }}
                >
                  {/* Notch */}
                  <div className="absolute top-[0.85rem] left-1/2 -translate-x-1/2 w-[34%] h-[0.55rem] rounded-full z-30" style={{ background: "#050507" }} />

                  {/* Tela */}
                  <div className="relative w-full h-full rounded-[1.85rem] overflow-hidden flex flex-col justify-between" style={{ background: ex.grad }}>
                    {isPlaying ? (
                      <video
                        src={`/videos/exemplos/${ex.slug}.mp4`}
                        // Mesma capa do card: sem ela o vídeo pisca preto no
                        // instante entre o clique e o primeiro quadro.
                        poster={`/videos/exemplos/${ex.slug}-capa.webp`}
                        autoPlay
                        playsInline
                        disablePictureInPicture
                        controlsList="nodownload nofullscreen noremoteplayback"
                        onEnded={() => setPlaying(null)}
                        onError={() => { setErrored((p) => ({ ...p, [ex.slug]: true })); setPlaying(null) }}
                        onClick={() => setPlaying(null)}
                        className="absolute inset-0 w-full h-full object-contain z-20 bg-black cursor-pointer"
                      />
                    ) : (
                      <>
                        {/* Capa = quadro REAL do vídeo (pedido do Audrei:
                            chamar atenção com a imagem de verdade em vez do
                            gradiente). Extraída com ffmpeg pelo filtro
                            `thumbnail`, que escolhe um quadro representativo
                            — o primeiro quadro costuma ser preto ou uma
                            transição.

                            `lazy` porque a seção fica abaixo da dobra: são 4
                            imagens que ninguém vê ao abrir a home. Se o
                            arquivo faltar, `onError` esconde a imagem e o
                            gradiente do card (ex.grad, atrás) reaparece — a
                            capa some, o card não quebra. */}
                        <img
                          src={`/videos/exemplos/${ex.slug}-capa.webp`}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = "none" }}
                          className="absolute inset-0 w-full h-full object-cover"
                        />

                        {/* Vinheta pra legibilidade do texto */}
                        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.3) 34%,rgba(0,0,0,0) 48%,rgba(0,0,0,0) 62%,rgba(0,0,0,0.55) 100%)" }} />

                        {/* Badge da ocasião */}
                        <span className="relative z-10 self-start mt-[1.4rem] ml-[0.85rem] px-[0.65rem] py-[0.3rem] text-[0.6rem] font-bold uppercase rounded-full text-white"
                              style={{ letterSpacing: "0.09em", background: "rgba(10,8,14,0.45)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.18)" }}>
                          {ex.ocasiao}
                        </span>

                        {/* Aqui o card desenhava "Uma música especial para /
                            nome / música". Saiu junto com a entrada da capa
                            real: o próprio quadro do vídeo já traz esse
                            texto, então os dois apareciam sobrepostos, um
                            por cima do outro. A legenda abaixo do celular
                            continua repetindo nome, música e ocasião, então
                            nenhuma informação se perdeu. */}

                        {/* Play central */}
                        <button
                          onClick={() => setPlaying(ex.slug)}
                          aria-label={`Assistir a música de ${ex.nome}`}
                          className="absolute inset-0 z-10 flex items-center justify-center group"
                        >
                          <span className="relative w-[4.2rem] h-[4.2rem] rounded-full flex items-center justify-center">
                            <span className="absolute rounded-full transition-transform duration-300 group-hover:scale-110" style={{ inset: "-0.3rem", border: "1.5px solid rgba(255,255,255,0.45)" }} />
                            <span className="relative w-[3.7rem] h-[3.7rem] rounded-full flex items-center justify-center text-white text-xl pl-[0.2rem] transition-transform duration-300 group-hover:scale-105"
                                  style={{ background: "rgba(15,10,20,0.35)", border: "1px solid rgba(255,255,255,0.55)", backdropFilter: "blur(4px)", boxShadow: "0 8px 30px -6px rgba(0,0,0,0.55), 0 0 0 8px rgba(255,255,255,0.06)" }}>
                              ▶
                            </span>
                          </span>
                        </button>

                        {/* Rodapé: duração ou aviso "em breve" */}
                        <div className="relative z-10 flex items-end justify-between px-[0.85rem] pb-[0.95rem]">
                          <span className="text-[0.62rem] font-semibold text-white/85">
                            {isErrored ? "🎬 vídeo em breve" : ""}
                          </span>
                          <span className="text-[0.65rem] font-semibold text-white/85 tabular-nums whitespace-nowrap px-2 py-[0.2rem] rounded-full"
                                style={{ background: "rgba(10,8,14,0.4)", border: "1px solid rgba(255,255,255,0.16)" }}>
                            {ex.duracao}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Legenda abaixo do celular */}
                <div className="mt-[1.1rem] text-center max-w-[14rem]">
                  <p className="text-[0.98rem] font-extrabold text-white/90">{ex.nome}</p>
                  <p className="mt-[0.15rem] mb-[0.4rem] text-[0.84rem] italic text-white/45">&ldquo;{ex.musica}&rdquo;</p>
                  <p className="text-[0.66rem] font-bold uppercase" style={{ letterSpacing: "0.09em", color: "#f0196b" }}>{ex.ocasiao}</p>
                </div>
              </li>
            )
          })}
        </ul>

        <button
          onClick={() => scrollByCard(1)}
          aria-label="Próximo exemplo"
          className="hidden md:flex absolute right-[-0.5rem] top-[42%] -translate-y-1/2 z-10 w-11 h-11 rounded-full items-center justify-center text-2xl leading-none transition-colors"
          style={{ background: "rgba(18,15,28,0.85)", border: "1px solid rgba(255,255,255,0.14)", color: "#f5f3f7" }}
        >›</button>
      </div>
    </div>
  )
}
