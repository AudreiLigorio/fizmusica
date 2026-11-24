"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { track } from "@/lib/track"

// Banner de ocasiões. Substituiu o FizMusicaCarousel, que eram imagens com o
// texto GRAVADO dentro: no celular as etiquetas ficavam com ~8px e o
// parágrafo era ilegível. Aqui a foto é só fundo e todo texto é texto de
// verdade: uma frase grande por ocasião, um verso se escrevendo (mostra o
// "veja o refrão antes de pagar" sem explicar) e as subcategorias passando.
//
// Duas variantes:
//  - "home": grande; no computador, texto à esquerda e foto à direita. O
//    botão leva ao wizard com ?tema=.
//  - "wizard": compacta, mostrada no 1º passo para quem chega DE FORA (anúncio,
//    link direto). Começa pela música da Pâmela, a mesma do anúncio, e o
//    botão escolhe o tema ALI MESMO (onEscolher), sem trocar de página — o
//    ?produto= e a origem do anúncio não podem se perder no caminho.
//
// As fotos são as artes antigas; o texto gravado delas fica na metade
// esquerda da imagem, então o enquadramento mostra só a direita. O slide
// autoral não tem foto: a arte dele é o equalizador animado.
//
// `tema` é o label EXATO de wizard_occasions. Renomear a ocasião no admin só
// faz o wizard abrir na lista geral, sem quebrar.
//
// Versos originais, escritos para o banner. O da Pâmela é da música dela
// (pedido de demonstração, já usado no onboarding e no anúncio).

export const TEMA_AUTORAL = "Composição Livre"

export type SlideBanner = {
  slug: string
  tema: string // label da ocasião; "" no slide de exemplo
  img: string | null
  pos: string // enquadramento no celular
  pc?: string // enquadramento na versão compacta (wizard), com zoom maior
  ac: string
  tag: string
  titulo: [string, string]
  rotuloVerso: string
  verso: string
  cta: string
  chips: string[]
  exemplo?: boolean // abre o vídeo em vez de escolher tema
}

const AUTORAL: SlideBanner = {
  slug: "autoral", tema: TEMA_AUTORAL,
  img: null, pos: "", ac: "#fbbf24",
  tag: "🎧 Para quem compõe", titulo: ["Sua letra vira", "música de verdade"],
  rotuloVerso: "Sua letra",
  verso: "♪ Escrevi no caderno, agora toca no mundo…",
  cta: "Colar minha letra",
  chips: ["Sertanejo", "Pop", "Pagode", "Gospel", "Funk", "Rock", "MPB", "Publique no SpotFiz"],
}

const OCASIOES: SlideBanner[] = [
  {
    slug: "amor", tema: "Amor & Relacionamentos",
    img: "/images/homenagem_namorados_fizmusica_desktop.webp", pos: "92% 30%", ac: "#f472b6",
    tag: "❤️ Amor", titulo: ["A história de vocês", "virou refrão"], rotuloVerso: "Prévia do refrão",
    verso: "♪ Foi num café qualquer que a vida mudou de lugar…",
    cta: "Criar a música de vocês",
    chips: ["Dia dos Namorados", "Pedido de casamento", "Aniversário de namoro", "Bodas", "Reconciliação", "Pedido de namoro"],
  },
  {
    slug: "familia", tema: "Família e Amigos",
    img: "/images/homenagem_familia_fizmusica_desktop.webp", pos: "90% 30%", pc: "100% 30%", ac: "#fbbf24",
    tag: "🏡 Família e amigos", titulo: ["Pra quem sempre", "esteve lá"], rotuloVerso: "Prévia do refrão",
    verso: "♪ Teu abraço ainda é a casa onde eu volto…",
    cta: "Criar a música da família",
    chips: ["Mãe", "Pai", "Filhos", "Avós", "Netos", "Amigos"],
  },
  {
    slug: "gravidez", tema: "Gravidez Revelação",
    img: "/images/homenagem_gravidez_bebe_fizmusica_desktop.webp", pos: "88% 30%", pc: "92% 22%", ac: "#a78bfa",
    tag: "🍼 Gravidez e bebê", titulo: ["Uma canção pra quem", "ainda vai chegar"], rotuloVerso: "Prévia do refrão",
    verso: "♪ Antes de te ver, eu já sabia teu nome de cor…",
    cta: "Criar a música do bebê",
    chips: ["Chá revelação", "Contar pro papai", "Futura mamãe", "Toda a família"],
  },
  {
    slug: "datas", tema: "Datas comemorativas",
    img: "/images/homenagem_datasespeciais_fizmusica_desktop.webp", pos: "90% 30%", ac: "#fb923c",
    tag: "🎂 Datas especiais", titulo: ["Um parabéns que", "ninguém mais canta igual"], rotuloVerso: "Prévia do refrão",
    verso: "♪ Mais um ano seu, e o mundo ficou mais leve…",
    cta: "Criar a música da data",
    chips: ["Aniversário", "Dia das Mães", "Dia dos Pais", "Natal", "Ano novo", "Bodas"],
  },
  {
    slug: "conquistas", tema: "Momentos Especiais",
    img: "/images/homenagem_conquistas_fizmusica_desktop.webp", pos: "90% 30%", pc: "100% 55%", ac: "#34d399",
    tag: "🏆 Conquistas", titulo: ["Tem vitória que", "merece trilha"], rotuloVerso: "Prévia do refrão",
    verso: "♪ Cada não que eu ouvi virou degrau pra chegar…",
    cta: "Criar a música da conquista",
    chips: ["Formatura", "Promoção", "Aposentadoria", "Professor", "Boa viagem", "Noivos"],
  },
  {
    slug: "pet", tema: "Pets",
    img: "/images/homenagem_pet_fizmusica_desktop.webp", pos: "74% 55%", pc: "85% 100%", ac: "#c4b5fd",
    tag: "🐾 Pet", titulo: ["Pra quem deixou", "patinhas no coração"], rotuloVerso: "Prévia do refrão",
    verso: "♪ Quatro patas na porta, esperando eu chegar…",
    cta: "Criar a música do pet",
    chips: ["Homenagem pet", "Despedida pet"],
  },
]

const PAMELA: SlideBanner = {
  slug: "pamela", tema: "", exemplo: true,
  img: "/videos/exemplos/pamela-capa.webp", pos: "50% 56%", ac: "#f472b6",
  tag: "▶ Exemplo real", titulo: ["Ouça a música", "da Pâmela"], rotuloVerso: "Trecho da música",
  verso: "♪ Mas focar em você é o meu melhor talento…",
  cta: "Ouvir a música",
  chips: ["Pedido de namoro", "Pronta em minutos", "Letra sincronizada"],
}

// Home: as ocasiões e o autoral depois das três primeiras (quem chega pelo
// presente vê o presente primeiro). Wizard: a Pâmela abre a fila.
const SLIDES_HOME = [...OCASIOES.slice(0, 3), AUTORAL, ...OCASIOES.slice(3)]
const SLIDES_WIZARD = [PAMELA, ...OCASIOES.slice(0, 3), AUTORAL, ...OCASIOES.slice(3)]

const DURACAO = 6500

export default function BannerOcasioes({
  variante = "home",
  onEscolher,
}: {
  variante?: "home" | "wizard"
  onEscolher?: (s: SlideBanner) => void
}) {
  const router = useRouter()
  const slides = variante === "wizard" ? SLIDES_WIZARD : SLIDES_HOME
  const home = variante === "home"
  const [atual, setAtual] = useState(0)
  const [verso, setVerso] = useState("")
  const [textoVisivel, setTextoVisivel] = useState(true)
  const [ciclo, setCiclo] = useState(0) // reinicia a barra mesmo quando o índice repete
  const [video, setVideo] = useState(false)
  // Só baixa a foto da ocasião atual e da próxima: as 7 juntas passam de
  // 800 KB e a maioria das pessoas não vê todas.
  const [vistas, setVistas] = useState<Set<number>>(() => new Set([0, 1]))
  const toqueX = useRef<number | null>(null)
  const [semMovimento, setSemMovimento] = useState(false)

  useEffect(() => {
    setSemMovimento(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  const s = slides[atual]

  function ir(n: number) {
    const i = (n + slides.length) % slides.length
    setVistas((v) => new Set([...v, i, (i + 1) % slides.length]))
    setAtual(i)
    setCiclo((c) => c + 1)
  }

  // Troca automática (parada enquanto o vídeo está aberto). Recomeça a
  // contagem a cada troca, inclusive manual.
  useEffect(() => {
    if (video) return
    const t = setTimeout(() => ir(atual + 1), DURACAO)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual, ciclo, video])

  // Texto entra com fade e o verso se escreve letra por letra.
  useEffect(() => {
    setTextoVisivel(false)
    const letras = [...slides[atual].verso]
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
  }, [atual, ciclo, semMovimento, slides])

  function acionar() {
    if (s.exemplo) {
      track(home ? "cta_criar" : "recepcao", `exemplo_${s.slug}`)
      setVideo(true)
      return
    }
    if (onEscolher) {
      track("recepcao", `banner_${s.slug}`)
      onEscolher(s)
      return
    }
    track("cta_criar", `banner_${s.slug}`)
    router.push(`/criar?tema=${encodeURIComponent(s.tema)}`)
  }

  return (
    <>
      <div
        data-zona-escura
        className={`fm-bo ${home ? "fm-bo-lg h-[min(78svh,620px)] lg:h-[480px]" : "fm-bo-compacto h-[370px] w-full max-w-[400px] mx-auto"} relative overflow-hidden rounded-3xl text-white select-none`}
        style={{ background: "#160d20", ["--ac" as string]: s.ac, touchAction: "pan-y" }}
        role="region"
        aria-roledescription="carrossel"
        aria-label="O que dá pra criar"
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
        {/* Fotos (o autoral desenha a própria arte) */}
        <div className="fm-bo-fotos absolute inset-0" aria-hidden>
          {slides.map((sl, k) =>
            sl.img ? (
              <div
                key={sl.slug}
                className={`fm-bo-foto ${k === atual ? "on" : ""} ${semMovimento ? "" : "fm-bo-kb"}`}
                style={{
                  backgroundImage: vistas.has(k) ? `url(${sl.img})` : undefined,
                  ["--pm" as string]: sl.pos,
                  // Compacta: a foto só aparece na faixa de cima, então as
                  // artes antigas entram com zoom (senão o texto gravado vaza).
                  ...(!home && sl.img.includes("/homenagem_")
                    ? { backgroundSize: "auto 160%", backgroundPosition: sl.pc ?? "100% 18%" }
                    : {}),
                }}
              />
            ) : (
              <div key={sl.slug} className={`fm-bo-foto fm-bo-arte ${k === atual ? "on" : ""}`}>
                <div className="fm-bo-ondas">
                  {Array.from({ length: 28 }, (_, b) => (
                    <i key={b} style={{ animationDelay: `${-((b * 37) % 100) / 70}s`, animationDuration: `${0.9 + ((b * 13) % 7) / 10}s` }} />
                  ))}
                </div>
              </div>
            )
          )}
          <div className="fm-bo-sombra absolute inset-0" />
        </div>

        {/* Notas subindo */}
        {!semMovimento && (
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            {[0, 1, 2, 3, 4, 5, 6].map((k) => (
              <span
                key={k}
                className="fm-bo-nota"
                style={{ left: `${6 + k * 13}%`, top: `${home ? 38 + (k % 3) * 7 : 20 + (k % 3) * 6}%`, animationDelay: `${-k * 0.75}s` }}
              >
                {k % 2 ? "♪" : "♫"}
              </span>
            ))}
          </div>
        )}

        {/* Barras de progresso, estilo stories (também servem pra pular) */}
        <div className="absolute top-3 left-3.5 right-3.5 z-[3] flex gap-1.5">
          {slides.map((sl, k) => (
            <button
              key={sl.slug}
              type="button"
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
                    animationPlayState: video ? "paused" : undefined,
                  }}
                />
              </span>
            </button>
          ))}
        </div>

        <span className={`fm-bo-vidro absolute top-7 left-3.5 z-[3] inline-flex items-center text-[13px] font-semibold px-3 py-1.5 rounded-full ${home ? "lg:left-12 lg:top-10" : ""}`}>
          {s.tag}
        </span>

        {/* Texto */}
        <div className={`absolute inset-x-0 bottom-0 z-[3] flex flex-col pb-4 ${home ? "gap-3.5 lg:inset-y-0 lg:right-auto lg:w-[48%] lg:justify-center lg:gap-5 lg:pb-0 lg:pt-10" : "gap-3"}`}>
          <div
            className={`px-[18px] transition-all duration-500 ${home ? "lg:px-12" : ""}`}
            style={{ opacity: textoVisivel ? 1 : 0, transform: textoVisivel ? "none" : "translateY(14px)" }}
            aria-live="polite"
          >
            <h3
              className={`font-extrabold leading-[1.08] tracking-tight ${home ? "mb-3.5 lg:mb-5" : "mb-2.5"}`}
              style={{ fontSize: home ? "clamp(1.75rem, 3.2vw, 2.6rem)" : "1.5rem", textShadow: "0 2px 16px rgba(0,0,0,0.4)" }}
            >
              {s.titulo[0]}{" "}
              <span style={{ color: "var(--ac)" }}>{s.titulo[1]}</span>
            </h3>
            <div className={`fm-bo-vidro rounded-2xl px-3.5 ${home ? "py-3" : "py-2.5"}`}>
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em] mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>
                <span>{s.rotuloVerso}</span>
                <span className="fm-bo-eq" aria-hidden><i /><i /><i /><i /><i /></span>
              </div>
              <p className={`italic leading-snug ${home ? "text-base min-h-[46px]" : "text-[15px] min-h-[42px]"} ${semMovimento ? "" : "fm-bo-cursor"}`}>{verso}</p>
            </div>
          </div>

          {home && (
            <div className="fm-bo-faixa overflow-hidden" aria-hidden>
              <div className={`flex gap-2 w-max ${semMovimento ? "" : "fm-bo-rolar"}`} key={atual}>
                {[...s.chips, ...s.chips, ...s.chips].map((c, k) => (
                  <span key={k} className="fm-bo-chip text-[13px] px-3 py-1.5 rounded-full whitespace-nowrap">{c}</span>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={acionar}
            className={`fm-bo-cta mx-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 ${home ? "py-3.5 text-base lg:mx-12 lg:self-start lg:px-10" : "py-3 text-[15px]"} ${semMovimento ? "" : "fm-bo-pulso"}`}
            style={s.slug === "autoral" ? { color: "#1a1205" } : undefined}
          >
            ▶&nbsp; {s.cta}
          </button>
        </div>
      </div>

      {/* Vídeo do exemplo — o mesmo player do anúncio */}
      {video && (
        <div
          data-zona-escura
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setVideo(false)}
          role="dialog"
          aria-label="Música da Pâmela"
        >
          <div className="relative w-full max-w-[360px]" onClick={(e) => e.stopPropagation()}>
            <video
              src="/videos/exemplos/pamela.mp4"
              poster="/videos/exemplos/pamela-capa.webp"
              controls
              autoPlay
              playsInline
              className="w-full rounded-2xl bg-black"
              style={{ maxHeight: "78svh" }}
            />
            <button
              type="button"
              onClick={() => {
                setVideo(false)
                // A da Pâmela é um pedido de namoro: "quero uma assim" abre
                // o tema Amor, onde ele está.
                if (onEscolher) { track("recepcao", "pamela_quero"); onEscolher(OCASIOES[0]) }
              }}
              className="mt-3 w-full rounded-2xl py-3 font-semibold text-white"
              style={{ background: "#f0196b" }}
            >
              Quero uma assim
            </button>
          </div>
        </div>
      )}
    </>
  )
}
