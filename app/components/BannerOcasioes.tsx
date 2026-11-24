"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { track } from "@/lib/track"

// Banner de ocasiões da home. Substituiu o FizMusicaCarousel, que eram
// imagens com o texto GRAVADO dentro: no celular as etiquetas ficavam com
// ~8px e o parágrafo era ilegível. Aqui a foto é só fundo e todo texto é
// texto de verdade: uma frase grande por ocasião, um verso de refrão se
// escrevendo (mostra o "veja o refrão antes de pagar" sem explicar) e as
// subcategorias passando numa faixa.
//
// As fotos são as mesmas artes de antes; o texto gravado delas fica do lado
// esquerdo da imagem, então o enquadramento mostra só a parte da direita.
//
// `tema` é o label EXATO de wizard_occasions: o botão abre o wizard já com
// aquele tema aberto (?tema=). Se o admin renomear a ocasião, o wizard
// simplesmente abre na lista de temas, sem quebrar.
//
// Os versos são originais, escritos para o banner (não são de clientes).

type Slide = {
  slug: string
  tema: string
  img: string
  pos: string // enquadramento no celular
  ac: string
  tag: string
  titulo: [string, string]
  verso: string
  cta: string
  chips: string[]
}

const SLIDES: Slide[] = [
  {
    slug: "amor", tema: "Amor & Relacionamentos",
    img: "/images/homenagem_namorados_fizmusica_desktop.webp", pos: "92% 30%", ac: "#f472b6",
    tag: "❤️ Amor", titulo: ["A história de vocês", "virou refrão"],
    verso: "♪ Foi num café qualquer que a vida mudou de lugar…",
    cta: "Criar a música de vocês",
    chips: ["Dia dos Namorados", "Pedido de casamento", "Aniversário de namoro", "Bodas", "Reconciliação", "Pedido de namoro"],
  },
  {
    slug: "familia", tema: "Família e Amigos",
    img: "/images/homenagem_familia_fizmusica_desktop.webp", pos: "90% 30%", ac: "#fbbf24",
    tag: "🏡 Família e amigos", titulo: ["Pra quem sempre", "esteve lá"],
    verso: "♪ Teu abraço ainda é a casa onde eu volto…",
    cta: "Criar a música da família",
    chips: ["Mãe", "Pai", "Filhos", "Avós", "Netos", "Amigos"],
  },
  {
    slug: "gravidez", tema: "Gravidez Revelação",
    img: "/images/homenagem_gravidez_bebe_fizmusica_desktop.webp", pos: "88% 30%", ac: "#a78bfa",
    tag: "🍼 Gravidez e bebê", titulo: ["Uma canção pra quem", "ainda vai chegar"],
    verso: "♪ Antes de te ver, eu já sabia teu nome de cor…",
    cta: "Criar a música do bebê",
    chips: ["Chá revelação", "Contar pro papai", "Futura mamãe", "Toda a família"],
  },
  {
    slug: "datas", tema: "Datas comemorativas",
    img: "/images/homenagem_datasespeciais_fizmusica_desktop.webp", pos: "90% 30%", ac: "#fb923c",
    tag: "🎂 Datas especiais", titulo: ["Um parabéns que", "ninguém mais canta igual"],
    verso: "♪ Mais um ano seu, e o mundo ficou mais leve…",
    cta: "Criar a música da data",
    chips: ["Aniversário", "Dia das Mães", "Dia dos Pais", "Natal", "Ano novo", "Bodas"],
  },
  {
    slug: "conquistas", tema: "Momentos Especiais",
    img: "/images/homenagem_conquistas_fizmusica_desktop.webp", pos: "90% 30%", ac: "#34d399",
    tag: "🏆 Conquistas", titulo: ["Tem vitória que", "merece trilha"],
    verso: "♪ Cada não que eu ouvi virou degrau pra chegar…",
    cta: "Criar a música da conquista",
    chips: ["Formatura", "Promoção", "Aposentadoria", "Professor", "Boa viagem", "Noivos"],
  },
  {
    slug: "pet", tema: "Pets",
    img: "/images/homenagem_pet_fizmusica_desktop.webp", pos: "74% 55%", ac: "#c4b5fd",
    tag: "🐾 Pet", titulo: ["Pra quem deixou", "patinhas no coração"],
    verso: "♪ Quatro patas na porta, esperando eu chegar…",
    cta: "Criar a música do pet",
    chips: ["Homenagem pet", "Despedida pet"],
  },
]

const DURACAO = 6500

export default function BannerOcasioes() {
  const router = useRouter()
  const [atual, setAtual] = useState(0)
  const [verso, setVerso] = useState("")
  const [textoVisivel, setTextoVisivel] = useState(true)
  const [ciclo, setCiclo] = useState(0) // reinicia a barra mesmo quando o índice repete
  // Só baixa a foto da ocasião atual e da próxima: as 6 juntas são ~800 KB
  // e a maioria das pessoas não vê todas.
  const [vistas, setVistas] = useState<Set<number>>(() => new Set([0, 1]))
  const toqueX = useRef<number | null>(null)
  const [semMovimento, setSemMovimento] = useState(false)

  useEffect(() => {
    setSemMovimento(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  const s = SLIDES[atual]

  function ir(n: number) {
    const i = (n + SLIDES.length) % SLIDES.length
    setVistas((v) => new Set([...v, i, (i + 1) % SLIDES.length]))
    setAtual(i)
    setCiclo((c) => c + 1)
  }

  // Troca automática. Recomeça a contagem a cada troca (inclusive manual).
  useEffect(() => {
    const t = setTimeout(() => ir(atual + 1), DURACAO)
    return () => clearTimeout(t)
  }, [atual, ciclo])

  // Texto entra com fade e o verso se escreve letra por letra.
  useEffect(() => {
    setTextoVisivel(false)
    const letras = [...SLIDES[atual].verso]
    if (semMovimento) { setVerso(letras.join("")); setTextoVisivel(true); return }
    setVerso("")
    let n = 0
    let intervalo: ReturnType<typeof setInterval> | undefined
    const entrada = setTimeout(() => {
      setTextoVisivel(true)
      intervalo = setInterval(() => {
        n++
        setVerso(letras.slice(0, n).join(""))
        if (n >= letras.length && intervalo) clearInterval(intervalo)
      }, 45)
    }, 300)
    return () => { clearTimeout(entrada); if (intervalo) clearInterval(intervalo) }
  }, [atual, ciclo, semMovimento])

  function criar() {
    track("cta_criar", `banner_${s.slug}`)
    router.push(`/criar?tema=${encodeURIComponent(s.tema)}`)
  }

  return (
    <div
      data-zona-escura
      className="fm-bo relative overflow-hidden rounded-3xl text-white select-none h-[min(78svh,620px)] lg:h-[480px]"
      style={{ background: "#160d20", ["--ac" as string]: s.ac, touchAction: "pan-y" }}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Ocasiões para criar sua música"
      onTouchStart={(e) => { toqueX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (toqueX.current === null) return
        const dx = e.changedTouches[0].clientX - toqueX.current
        toqueX.current = null
        if (Math.abs(dx) > 40) ir(atual + (dx < 0 ? 1 : -1))
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return
        const r = e.currentTarget.getBoundingClientRect()
        ir(atual + (e.clientX - r.left < r.width / 3 ? -1 : 1))
      }}
    >
      {/* Fotos */}
      <div className="fm-bo-fotos absolute inset-0" aria-hidden>
        {SLIDES.map((sl, k) => (
          <div
            key={sl.slug}
            className={`fm-bo-foto ${k === atual ? "on" : ""} ${semMovimento ? "" : "fm-bo-kb"}`}
            style={{
              backgroundImage: vistas.has(k) ? `url(${sl.img})` : undefined,
              ["--pm" as string]: sl.pos,
            }}
          />
        ))}
        <div className="fm-bo-sombra absolute inset-0" />
      </div>

      {/* Notas subindo */}
      {!semMovimento && (
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          {[0, 1, 2, 3, 4, 5, 6].map((k) => (
            <span
              key={k}
              className="fm-bo-nota"
              style={{ left: `${6 + k * 13}%`, top: `${38 + (k % 3) * 7}%`, animationDelay: `${-k * 0.75}s` }}
            >
              {k % 2 ? "♪" : "♫"}
            </span>
          ))}
        </div>
      )}

      {/* Barras de progresso, estilo stories (também servem pra pular) */}
      <div className="absolute top-3 left-3.5 right-3.5 z-[3] flex gap-1.5">
        {SLIDES.map((sl, k) => (
          <button
            key={sl.slug}
            onClick={() => ir(k)}
            aria-label={sl.tag.replace(/^\S+\s/, "")}
            className="flex-1 py-1.5 -my-1.5"
          >
            <span className="block h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.35)" }}>
              <span
                key={`${k}-${ciclo}`}
                className="block h-full bg-white"
                style={{
                  width: k < atual ? "100%" : k > atual ? "0%" : undefined,
                  animation: k === atual ? `fmBoBarra ${DURACAO}ms linear forwards` : undefined,
                }}
              />
            </span>
          </button>
        ))}
      </div>

      <span className="fm-bo-vidro absolute top-7 left-3.5 lg:left-12 lg:top-10 z-[3] inline-flex items-center text-[13px] font-semibold px-3 py-1.5 rounded-full">
        {s.tag}
      </span>

      {/* Texto */}
      <div className="absolute inset-x-0 bottom-0 z-[3] flex flex-col gap-3.5 pb-4 lg:inset-y-0 lg:right-auto lg:w-[48%] lg:justify-center lg:gap-5 lg:pb-0 lg:pt-10">
        <div
          className="px-[18px] lg:px-12 transition-all duration-500"
          style={{ opacity: textoVisivel ? 1 : 0, transform: textoVisivel ? "none" : "translateY(14px)" }}
          aria-live="polite"
        >
          <h3 className="font-extrabold leading-[1.08] tracking-tight mb-3.5 lg:mb-5" style={{ fontSize: "clamp(1.75rem, 3.2vw, 2.6rem)", textShadow: "0 2px 16px rgba(0,0,0,0.4)" }}>
            {s.titulo[0]}{" "}
            <span style={{ color: "var(--ac)" }}>{s.titulo[1]}</span>
          </h3>
          <div className="fm-bo-vidro rounded-2xl px-3.5 py-3">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em] mb-1.5" style={{ color: "rgba(255,255,255,0.8)" }}>
              <span>Prévia do refrão</span>
              <span className="fm-bo-eq" aria-hidden><i /><i /><i /><i /><i /></span>
            </div>
            <p className={`text-base italic leading-snug min-h-[46px] ${semMovimento ? "" : "fm-bo-cursor"}`}>{verso}</p>
          </div>
        </div>

        <div className="fm-bo-faixa overflow-hidden" aria-hidden>
          <div className={`flex gap-2 w-max ${semMovimento ? "" : "fm-bo-rolar"}`} key={atual}>
            {[...s.chips, ...s.chips, ...s.chips].map((c, k) => (
              <span key={k} className="fm-bo-chip text-[13px] px-3 py-1.5 rounded-full whitespace-nowrap">{c}</span>
            ))}
          </div>
        </div>

        <button
          onClick={criar}
          className={`fm-bo-cta mx-4 lg:mx-12 lg:self-start lg:px-10 rounded-2xl py-3.5 font-semibold text-base text-white flex items-center justify-center gap-2 ${semMovimento ? "" : "fm-bo-pulso"}`}
        >
          ▶&nbsp; {s.cta}
        </button>
      </div>
    </div>
  )
}
