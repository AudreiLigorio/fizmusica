"use client"

import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay, EffectFade, EffectCards, EffectCoverflow } from "swiper/modules"

import "swiper/css"
import "swiper/css/effect-fade"
import "swiper/css/effect-cards"
import "swiper/css/effect-coverflow"

type EffectName = "slide" | "fade" | "cards" | "coverflow"

const MODULES = [Autoplay, EffectFade, EffectCards, EffectCoverflow]

export default function PhotoCarousel({
  photos,
  effect = "slide",
}: {
  photos: string[]
  effect?: EffectName
}) {
  if (!photos || photos.length === 0) return null

  // Cards e Coverflow ficam melhores como "pôster" centralizado;
  // Slide e Fade preenchem o fundo inteiro.
  const isDeck = effect === "cards" || effect === "coverflow"

  const common = {
    modules: MODULES,
    loop: photos.length > 1,
    autoplay: photos.length > 1
      ? { delay: 4000, disableOnInteraction: false }
      : (false as const),
    className: "w-full h-full",
  }

  if (isDeck) {
    return (
      <div className="fixed inset-0 flex items-center justify-center px-6">
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    )
  }

  // slide | fade — fundo de tela cheia
  return (
    <div className="fixed inset-0">
      <Swiper
        {...common}
        effect={effect === "fade" ? "fade" : "slide"}
        fadeEffect={effect === "fade" ? { crossFade: true } : undefined}
        allowTouchMove={photos.length > 1}
      >
        {photos.map((url, i) => (
          <SwiperSlide key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="w-full h-full object-cover object-center" />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}
