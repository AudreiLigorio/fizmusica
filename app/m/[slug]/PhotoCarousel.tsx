"use client"

import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay, EffectFade, EffectCards, EffectCoverflow } from "swiper/modules"

import "swiper/css"
import "swiper/css/effect-fade"
import "swiper/css/effect-cards"
import "swiper/css/effect-coverflow"

type EffectName = "slide" | "fade" | "cards" | "coverflow"

const MODULES = [Autoplay, EffectFade, EffectCards, EffectCoverflow]

/* Mostra a foto INTEIRA (object-contain) sobre uma cópia borrada que preenche
   o quadro — assim nenhum efeito corta a imagem e não fica barra vazia feia. */
function Frame({ url }: { url: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover scale-110"
        style={{ filter: "blur(28px) brightness(0.55)" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="absolute inset-0 w-full h-full object-contain" />
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
                <Frame url={url} />
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
      <Swiper
        {...common}
        effect={effect === "fade" ? "fade" : "slide"}
        fadeEffect={effect === "fade" ? { crossFade: true } : undefined}
        allowTouchMove={photos.length > 1}
      >
        {photos.map((url, i) => (
          <SwiperSlide key={i}>
            <Frame url={url} />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}
