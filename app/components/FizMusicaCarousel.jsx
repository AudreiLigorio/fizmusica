"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function FizMusicaCarousel() {

  const [current, setCurrent] = useState(0);
  const router = useRouter();

  const slides = [
    {
      desktop: "/images/homenagem_namorados_fizmusica_desktop.webp",
      mobile: "/images/homenagem_namorados_fizmusica_mobile.webp",
      alt: "Namorados",
    },

    {
      desktop: "/images/homenagem_familia_fizmusica_desktop.webp",
      mobile: "/images/homenagem_familia_fizmusica_mobile.webp",
      alt: "Família",
    },

    {
      desktop: "/images/homenagem_gravidez_bebe_fizmusica_desktop.webp",
      mobile: "/images/homenagem_gravidez_bebe_fizmusica_mobile.webp",
      alt: "Gravidez",
    },

    {
      desktop: "/images/homenagem_conquistas_fizmusica_desktop.webp",
      mobile: "/images/homenagem_conquistas_fizmusica_mobile.webp",
      alt: "Conquistas",
    },

    {
      desktop: "/images/homenagem_datasespeciais_fizmusica_desktop.webp",
      mobile: "/images/homenagem_datasespeciais_fizmusica_mobile.webp",
      alt: "Datas especiais",
    },

    {
      desktop: "/images/homenagem_pet_fizmusica_desktop.webp",
      mobile: "/images/homenagem_pet_fizmusica_mobile.webp",
      alt: "Pet",
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <section className="fm-carousel-section">

      {/* TRACK */}
      <div
        className="fm-carousel-track"
        style={{
          transform: `translateX(-${current * 100}%)`,
        }}
      >

        {slides.map((slide, index) => (

          <div
  className="fm-slide cursor-pointer"
  key={index}
  onClick={() => router.push("/criar")}
>

            <picture>

              <source
                media="(max-width: 768px)"
                srcSet={slide.mobile}
              />

              <img
                src={slide.desktop}
                alt={slide.alt}
                loading="lazy"
                decoding="async"
                draggable="false"
              />

            </picture>

          </div>

        ))}

      </div>

      {/* DOTS */}
      <div className="fm-dots">

        {slides.map((_, index) => (

          <button
            key={index}
            className={`fm-dot ${current === index ? "active" : ""}`}
            onClick={() => setCurrent(index)}
          />

        ))}

      </div>

    </section>
  );
}