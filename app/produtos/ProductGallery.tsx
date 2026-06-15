"use client"

import { useRef, useState } from "react"

type ProductImage = { id: string; url: string; is_cover: boolean; sort_order: number }

export default function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [active, setActive] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  if (!images || images.length === 0) return null

  const cover = images.find((i) => i.is_cover) ?? images[0]
  const all = [cover, ...images.filter((i) => !i.is_cover)]
  const current = all[active] ?? all[0]

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    // Só swipe horizontal com pelo menos 40px e dominante sobre o vertical
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) setActive((prev) => (prev + 1) % all.length)
    else setActive((prev) => (prev - 1 + all.length) % all.length)
    touchStartX.current = null
    touchStartY.current = null
  }

  return (
    <>
      <div className="w-full">
        {/* Imagem principal */}
        <div
          className="relative w-full rounded-2xl overflow-hidden cursor-zoom-in mb-2"
          style={{ aspectRatio: "4/3" }}
          onClick={() => setLightbox(true)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={current.url}
            alt={name}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
          {all.length > 1 && (
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
              {active + 1}/{all.length}
            </span>
          )}
        </div>

        {/* Miniaturas */}
        {all.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {all.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setActive(i)}
                className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                  i === active ? "border-pink-500" : "border-white/10 opacity-60 hover:opacity-100"
                }`}
              >
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl leading-none"
            onClick={() => setLightbox(false)}
          >×</button>

          {all.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-3xl px-2"
              onClick={(e) => { e.stopPropagation(); setActive((active - 1 + all.length) % all.length) }}
            >‹</button>
          )}

          <img
            src={current.url}
            alt={name}
            className="max-w-full max-h-[90vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />

          {all.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-3xl px-2"
              onClick={(e) => { e.stopPropagation(); setActive((active + 1) % all.length) }}
            >›</button>
          )}
        </div>
      )}
    </>
  )
}
