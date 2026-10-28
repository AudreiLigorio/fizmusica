"use client"

import Image from "next/image"
import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay, EffectFade, EffectCards, EffectCoverflow } from "swiper/modules"

import "swiper/css"
import "swiper/css/effect-fade"
import "swiper/css/effect-cards"
import "swiper/css/effect-coverflow"

type EffectName = "slide" | "fade" | "cards" | "coverflow"

const MODULES = [Autoplay, EffectFade, EffectCards, EffectCoverflow]

// ── Movimento da foto (Ken Burns) ────────────────────────────────────────
//
// Por que isto existe: medido em 28/10/2026, 162 dos 173 players entregues
// têm UMA foto só. Nesses, o Swiper nem liga o autoplay (a condição é
// `photos.length > 1`), então não há transição nenhuma pra variar — a imagem
// fica absolutamente parada durante a música inteira. O movimento precisa
// acontecer DENTRO da foto, não entre fotos.
//
// É transform em CSS: roda na GPU, não baixa nada, não pesa. O mesmo efeito
// que o ffmpeg grava num vídeo, só que aqui quem faz é o navegador.
//
// `alternate infinite` em vez de um ciclo que reinicia: a foto vai e volta,
// sem o salto seco de voltar ao começo — e isso importa justamente no caso de
// uma foto só, onde a animação nunca acaba.
const MOVIMENTOS = [
  { nome: "fizkb0", de: "scale(1.00)",                   para: "scale(1.12)",                   dur: 24 },
  { nome: "fizkb1", de: "scale(1.16)",                   para: "scale(1.02)",                   dur: 28 },
  { nome: "fizkb2", de: "scale(1.06) translate(-1.6%,0)", para: "scale(1.14) translate(1.6%,0)", dur: 26 },
  { nome: "fizkb3", de: "scale(1.06) translate(0,1.6%)",  para: "scale(1.14) translate(0,-1.6%)", dur: 30 },
]

// Deriva (translate) de no máximo 1,6% de propósito. A foto é `object-contain`
// sobre um fundo borrado — ela NÃO preenche o quadro, então deslocamento
// grande faria a imagem passear por cima do fundo e denunciar a emenda. O
// zoom é o movimento seguro aqui; a deriva entra só como tempero.

const CSS_MOVIMENTO = `
${MOVIMENTOS.map((m) => `@keyframes ${m.nome}{from{transform:${m.de}}to{transform:${m.para}}}`).join("\n")}
.fiz-kb{will-change:transform}
@media (prefers-reduced-motion: reduce){.fiz-kb{animation:none !important}}
`

// Semente ESTÁVEL por música, tirada da própria URL da foto (que carrega o id
// do pedido). Nada de Math.random: sorteio de verdade mudaria o player a cada
// abertura — a pessoa volta no link do presente dela e encontra outra coisa,
// o que parece defeito — e, pior, daria resultado diferente no render do
// servidor e na hidratação do cliente. Assim cada música tem o seu movimento,
// sempre o mesmo, e músicas diferentes ficam diferentes entre si.
function semente(txt: string): number {
  let h = 2166136261
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/* Mostra a foto INTEIRA (object-contain) sobre uma cópia borrada que preenche
   o quadro — assim nenhum efeito corta a imagem e não fica barra vazia feia. */
function Frame({ url, prioridade, variante }: { url: string; prioridade: boolean; variante: number }) {
  const mov = MOVIMENTOS[variante % MOVIMENTOS.length]
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Fundo borrado: pode ser minúsculo, ninguém vê detalhe atrás de 28px
          de blur. 64px de largura resolve e pesa quase nada. */}
      <Image
        src={url}
        alt=""
        aria-hidden
        fill
        sizes="64px"
        quality={40}
        className="object-cover scale-110"
        style={{ filter: "blur(28px) brightness(0.55)" }}
      />
      {/* O movimento vai no INVÓLUCRO, não na <Image>: o next/image com `fill`
          já controla position e inset, e empilhar transform nele é pedir
          briga com o que a lib faz. */}
      <div
        className="fiz-kb absolute inset-0"
        style={{ animation: `${mov.nome} ${mov.dur}s ease-in-out infinite alternate` }}
      >
        {/* Foto em si: servida no tamanho da tela e em formato moderno, em vez
            do arquivo original de 3 a 5 MB que sai do celular. As primeiras
            entram com prioridade pra não haver quadro vazio na largada. */}
        <Image
          src={url}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 640px"
          priority={prioridade}
          className="object-contain"
        />
      </div>
    </div>
  )
}

export default function PhotoCarousel({
  photos,
  effect = "slide",
}: {
  photos: string[]
  effect?: EffectName
}) {
  if (!photos || photos.length === 0) return null

  const isDeck = effect === "cards" || effect === "coverflow"

  // A semente sai da primeira foto porque a URL dela traz o id do pedido —
  // único por música e igual em todo render. Cada foto da sequência anda uma
  // casa, pra duas fotos vizinhas não se moverem em sincronia.
  const base = semente(photos[0])

  const common = {
    modules: MODULES,
    loop: photos.length > 1,
    autoplay: photos.length > 1
      ? { delay: 6000, disableOnInteraction: false }
      : (false as const),
    className: "w-full h-full",
  }

  if (isDeck) {
    return (
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <style>{CSS_MOVIMENTO}</style>
        <div className="w-[78vw] max-w-[420px] aspect-[3/4]">
          <Swiper
            {...common}
            effect={effect === "cards" ? "cards" : "coverflow"}
            grabCursor
            coverflowEffect={
              effect === "coverflow"
                ? { rotate: 40, stretch: 0, depth: 120, modifier: 1, slideShadows: true }
                : undefined
            }
            slidesPerView={effect === "coverflow" ? 1.4 : 1}
            centeredSlides
          >
            {photos.map((url, i) => (
              <SwiperSlide key={i} className="rounded-3xl overflow-hidden">
                <Frame url={url} prioridade={i < 2} variante={base + i} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    )
  }

  // slide | fade — preenche o container (relative pai)
  return (
    <div className="absolute inset-0">
      <style>{CSS_MOVIMENTO}</style>
      <Swiper
        {...common}
        effect={effect === "fade" ? "fade" : "slide"}
        fadeEffect={effect === "fade" ? { crossFade: true } : undefined}
        allowTouchMove={photos.length > 1}
      >
        {photos.map((url, i) => (
          <SwiperSlide key={i}>
            <Frame url={url} prioridade={i < 2} variante={base + i} />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}
