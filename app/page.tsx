"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { track } from "@/lib/track"
import { useRouter } from "next/navigation"
import FizMusicaCarousel from "./components/FizMusicaCarousel"
import Header from "./components/Header"
import Footer from "./components/Footer"
import ExperienceVideo from "./components/ExperienceVideo"
import VideoExemplos from "./components/VideoExemplos"
import FaqHome from "./components/FaqHome"
import ResumeMusicBanner from "./components/ResumeMusicBanner"

const DEMOS = [
  { id: "namoro",    src: "/namoro_2anos.mp3",          title: "Homenagem Dia dos Namorados", meta: "Maria Eduarda · Sertanejo romântico · 3:12", emoji: "💖" },
  { id: "casamento", src: "/aniversario_casamento.mp3", title: "Aniversário de Casamento",     meta: 'Patricia "Mô" · Pagode romântico · 2:58',  emoji: "💍" },
  { id: "revelacao", src: "/cha_revelacao_menina.mp3",  title: "Chá Revelação",                meta: "É Menina · Sertanejo animado · 3:34",       emoji: "🎀" },
  { id: "pet",       src: "/despedida_pet.mp3",         title: "Despedida — Amora",            meta: "MPB sentimental · 3:20",                    emoji: "🐾" },
]

// Vídeo do hero (fundo em loop). Duas resoluções — baixa só a certa por tela.
const HERO_POSTER = "/videos/hero-home.poster.jpg"
const HERO_SRC_DESKTOP = "/videos/hero-home.opt.mp4"    // 720p, ~1MB
const HERO_SRC_MOBILE = "/videos/hero-home.mobile.mp4"  // 480p, ~490KB

const STEPS = [
  { n: "1", label: "Conte sua história",    desc: "Escolha a ocasião e preencha o questionário guiado." },
  { n: "2", label: "Escolha o estilo e sentimento", desc: "Sertanejo, MPB, pagode, pop — você decide." },
  { n: "3", label: "É só adicionar as suas fotos.", desc: "Aqui você vai surpreender ainda mais." },
  { n: "4", label: "Emocione alguém",        desc: "Um presente que ficará guardado para sempre." },
]

const STEP_GRADIENTS = [
  "linear-gradient(135deg, #f0196b, #d946ef)",
  "linear-gradient(135deg, #d946ef, #f0196b)",
  "linear-gradient(135deg, #f0196b, #d946ef)",
  "linear-gradient(135deg, #d946ef, #f0196b)",
]

const STATS = [
  { target: 10000, prefix: "+", suffix: "",  decimals: 0, label: "músicas criadas" },
  { target: 8000,  prefix: "+", suffix: "",  decimals: 0, label: "clientes emocionados" },
  { target: 4.9,   prefix: "",  suffix: "",  decimals: 1, label: "de satisfação média" },
  { target: 100,   prefix: "",  suffix: "%", decimals: 0, label: "personalizado" },
]

const WHY = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
    title: "Experiência emocional real",
    desc: "Cada música nasce da sua história, sentimentos e momentos marcantes.",
    gradient: "linear-gradient(135deg, #f0196b, #d946ef)",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
    ),
    title: "Letra exclusiva para você",
    desc: "A letra é editada e validada por você, online. Você tem à disposição 3 edições e uma revisão completa.",
    gradient: "linear-gradient(135deg, #d946ef, #f0196b)",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    title: "Plataforma premium assistida",
    desc: "Nossa plataforma é completa. Vamos além e entregamos muitas funcionalidades desde a música até a produção final. Tudo é feito por você, de forma online e sem esperas.",
    gradient: "linear-gradient(135deg, #f0196b, #d946ef)",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
    title: "Satisfação garantida",
    desc: "Nosso produto é diferenciado e feito para emocionar de verdade.",
    gradient: "linear-gradient(135deg, #d946ef, #f0196b)",
  },
]

function useCountUp(target: number, decimals: number, duration = 1800) {
  const [value, setValue] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  const start = useCallback(() => {
    if (started) return
    setStarted(true)
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(parseFloat((eased * target).toFixed(decimals)))
      if (progress < 1) requestAnimationFrame(tick)
      else setValue(target)
    }
    requestAnimationFrame(tick)
  }, [started, target, decimals, duration])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) start() },
      { threshold: 0.4 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [start])

  return { ref, value }
}

function StatItem({ stat, displayFont, bodyFont }: {
  stat: typeof STATS[0],
  displayFont: React.CSSProperties,
  bodyFont: React.CSSProperties,
}) {
  const { ref, value } = useCountUp(stat.target, stat.decimals)
  const display = stat.decimals > 0
    ? value.toFixed(stat.decimals).replace(".", ",")
    : Math.floor(value).toLocaleString("pt-BR")

  return (
    <div ref={ref} className="text-center group">
      <p
        className="mb-1 tabular-nums leading-none"
        style={{
          ...displayFont,
          fontSize: "clamp(2rem, 3.5vw, 3rem)",
          fontWeight: 700,
          color: "rgba(255,255,255,0.92)",
          letterSpacing: "-0.02em",
        }}
      >
        {stat.prefix}{display}{stat.suffix}
      </p>
      <p className="text-xs tracking-wide" style={{ ...bodyFont, color: "rgba(255,255,255,0.3)" }}>
        {stat.label}
      </p>
    </div>
  )
}

export default function Home() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentAudio, setCurrentAudio] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const router = useRouter()

  // Vídeo de fundo do hero: escolhe a resolução no cliente (baixa só a certa)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  useEffect(() => {
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches
    setVideoSrc(isDesktop ? HERO_SRC_DESKTOP : HERO_SRC_MOBILE)
  }, [])
  useEffect(() => {
    if (videoSrc) videoRef.current?.play().catch(() => {})
  }, [videoSrc])

  function togglePlay(src: string) {
    if (!audioRef.current) return
    if (currentAudio === src && playing) {
      audioRef.current.pause(); setPlaying(false); return
    }
    audioRef.current.src = src
    audioRef.current.play()
    setCurrentAudio(src); setPlaying(true)
  }

  const displayFont = { fontFamily: "'Cormorant Garamond', Georgia, serif" }
  const bodyFont    = { fontFamily: "'DM Sans', system-ui, sans-serif" }

  return (
    <div className="noise min-h-screen text-white overflow-x-hidden" style={{ backgroundColor: "#07060d", ...bodyFont }}>
      <Header />
      <ResumeMusicBanner />

      {/* ═══════════════════════════════════════════
          HERO — vídeo de fundo em loop + textos sobrepostos
          (altura = conteúdo; o vídeo fecha junto com os textos)
      ═══════════════════════════════════════════ */}
      <section className="relative flex items-center overflow-hidden">

        {/* vídeo de fundo (loop, mudo, autoplay) */}
        <video
          ref={videoRef}
          src={videoSrc ?? undefined}
          poster={HERO_POSTER}
          muted
          playsInline
          autoPlay
          loop
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover z-0"
        />

        {/* overlays de legibilidade: escurece geral + reforça esquerda (desktop) e base (mobile) */}
        <div className="absolute inset-0 z-10 pointer-events-none"
             style={{ background: "linear-gradient(90deg, rgba(7,6,13,0.92) 0%, rgba(7,6,13,0.75) 38%, rgba(7,6,13,0.35) 70%, rgba(7,6,13,0.25) 100%)" }} />
        <div className="absolute inset-0 z-10 pointer-events-none lg:hidden"
             style={{ background: "linear-gradient(180deg, rgba(7,6,13,0.55) 0%, rgba(7,6,13,0.35) 40%, rgba(7,6,13,0.9) 100%)" }} />
        <div className="absolute inset-0 z-10 pointer-events-none"
             style={{ background: "radial-gradient(ellipse at 20% 30%, rgba(240,25,107,0.14) 0%, transparent 55%)" }} />

        {/* conteúdo sobreposto — pt extra pra limpar o header fixo */}
        <div className="relative z-20 max-w-6xl mx-auto px-6 pt-28 lg:pt-36 pb-16 lg:pb-24 w-full">
          <div className="max-w-xl">
            <p className="animate-fade-up delay-100 text-[#ff6b9d] text-xs font-medium tracking-[0.3em] uppercase mb-6" style={bodyFont}>
              Músicas personalizadas
            </p>

            <h1 className="animate-fade-up delay-200 leading-[0.95] mb-7" style={{ ...displayFont, textShadow: "0 2px 30px rgba(0,0,0,0.6)" }}>
              <span className="block font-light text-white" style={{ fontSize: "clamp(1.9rem, 3.6vw, 3rem)" }}>O primeiro presente</span>
              <span className="block font-light text-white" style={{ fontSize: "clamp(1.9rem, 3.6vw, 3rem)" }}>que pode ser ouvido,</span>
              <em className="block font-semibold not-italic" style={{ fontSize: "clamp(2.1rem, 4vw, 3.3rem)", color: "#ff3d84" }}>assistido e compartilhado.</em>
            </h1>

            <p className="animate-fade-up delay-300 text-white/75 leading-relaxed mb-9 max-w-sm" style={{ ...bodyFont, fontSize: "1rem", textShadow: "0 1px 12px rgba(0,0,0,0.6)" }}>
              Transforme uma história real em uma música exclusiva criada especialmente para quem você ama. Com fotos, letra sincronizada, QR Code e um player personalizado.
            </p>

            <div className="animate-fade-up delay-400 flex flex-wrap gap-3 mb-9">
              <button
                onClick={() => { track("cta_criar", "home"); router.push("/criar") }}
                className="text-white px-8 py-4 rounded-2xl transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                style={{
                  ...bodyFont,
                  background: "linear-gradient(135deg, #f0196b 0%, #d946ef 100%)",
                  fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "0.02em",
                  boxShadow: "0 8px 32px rgba(240,25,107,0.5), 0 2px 8px rgba(217,70,239,0.3)",
                }}
              >
                Criar minha música ❤️
              </button>
            </div>

            <div className="animate-fade-up delay-500 flex flex-wrap gap-6 text-xs text-white/70 tracking-wide" style={bodyFont}>
              {[
                { label: "Presente único", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg> },
                { label: "Entrega imediata", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> },
                { label: "Pagamento seguro", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
              ].map(({ label, icon }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span style={{ color: "#ff3d84" }}>{icon}</span> {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          EXEMPLOS EM VÍDEO — player pronto no celular
      ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 pt-14 lg:pt-20 pb-2">
        <VideoExemplos />
      </section>

      {/* ═══════════════════════════════════════════
          PLAYER DE EXEMPLOS — abaixo do hero
      ═══════════════════════════════════════════ */}
      <section className="max-w-3xl mx-auto px-6 py-14 lg:py-20">
        <div className="text-center mb-8">
          <span className="inline-block text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4"
                style={{ background: "rgba(240,25,107,0.12)", color: "#ff6b9d", letterSpacing: "0.12em" }}>
            🎧 exemplos
          </span>
          <h2 className="font-light text-white/90 leading-tight" style={{ ...displayFont, fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)" }}>
            Ouça como ficam as músicas
          </h2>
          <p className="text-white/50 text-sm mt-2" style={bodyFont}>
            Músicas reais já entregues — a sua será única e personalizada.
          </p>
        </div>

        <div className="rounded-3xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
             style={{ background: "linear-gradient(160deg, rgba(240,25,107,0.14) 0%, rgba(217,70,239,0.10) 50%, rgba(255,255,255,0.03) 100%)", border: "1px solid rgba(240,25,107,0.2)", backdropFilter: "blur(24px)" }}>
          <div className="space-y-0 p-2">
            {DEMOS.map((d, idx) => {
              const isActive = currentAudio === d.src && playing
              return (
                <button
                  key={d.id}
                  onClick={() => togglePlay(d.src)}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left transition-all duration-200 group"
                  style={{ background: isActive ? "rgba(240,25,107,0.15)" : "rgba(255,255,255,0.03)" }}
                >
                  <span className="shrink-0 w-6 text-center tabular-nums"
                        style={{ ...bodyFont, fontSize: "0.7rem", color: isActive ? "rgba(240,25,107,0.8)" : "rgba(255,255,255,0.25)" }}>
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate leading-snug mb-0.5"
                       style={{ ...bodyFont, fontSize: "0.875rem", fontWeight: 500, color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)" }}>
                      {d.emoji} {d.title}
                    </p>
                    <p className="truncate" style={{ ...bodyFont, fontSize: "0.72rem", color: isActive ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.4)" }}>
                      {d.meta}
                    </p>
                  </div>
                  <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
                       style={{
                         background: isActive ? "#f0196b" : "rgba(255,255,255,0.07)",
                         boxShadow: isActive ? "0 0 18px rgba(240,25,107,0.55)" : "none",
                         border: `1px solid ${isActive ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.1)"}`,
                       }}>
                    {isActive ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                        <rect x="2" y="1" width="3" height="10" rx="1"/><rect x="7" y="1" width="3" height="10" rx="1"/>
                      </svg>
                    ) : (
                      <svg width="11" height="12" viewBox="0 0 11 12" fill="none" style={{ marginLeft: "1px" }}>
                        <path d="M1 1.5L10 6L1 10.5V1.5Z" fill="rgba(255,255,255,0.7)" stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <audio ref={audioRef} onEnded={() => { setPlaying(false); setCurrentAudio(null) }} />
      </section>


      {/* ═══════════════════════════════════════════
          CARROSSEL
      ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 py-8 lg:py-16">
        <FizMusicaCarousel />
      </section>

      {/* ═══════════════════════════════════════════
          COMO FUNCIONA
      ═══════════════════════════════════════════ */}
      <section className="py-14 lg:py-28 border-y border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-6">

          <div className="mb-16">
            <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ ...bodyFont, color: "#f0196b" }}>
              Processo
            </p>
            <h2 className="font-light text-white/90 leading-tight"
                style={{ ...displayFont, fontSize: "clamp(2.2rem, 4vw, 3.5rem)" }}>
              Em apenas alguns passos,<br />
              <em style={{ color: "#f0196b" }}>sua história vira uma surpresa inesquecível.</em>
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <div key={s.n}
                   className="group relative p-8 rounded-3xl cursor-default"
                   style={{
                     background: "rgba(14,13,26,0.95)",
                     border: "1px solid rgba(255,255,255,0.07)",
                     transition: "transform 0.3s cubic-bezier(.16,1,.3,1), box-shadow 0.3s ease, border-color 0.3s ease",
                   }}
                   onMouseEnter={e => {
                     const el = e.currentTarget
                     el.style.transform = "translateY(-10px) scale(1.02)"
                     el.style.boxShadow = "0 24px 60px rgba(240,25,107,0.22), 0 8px 24px rgba(0,0,0,0.6)"
                     el.style.borderColor = "rgba(240,25,107,0.35)"
                     el.style.background = "rgba(20,18,35,1)"
                     el.style.zIndex = "10"
                   }}
                   onMouseLeave={e => {
                     const el = e.currentTarget
                     el.style.transform = ""
                     el.style.boxShadow = ""
                     el.style.borderColor = "rgba(255,255,255,0.07)"
                     el.style.background = "rgba(14,13,26,0.95)"
                     el.style.zIndex = ""
                   }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                     style={{ background: STEP_GRADIENTS[i], boxShadow: "0 4px 20px rgba(240,25,107,0.3)" }}>
                  <span className="text-white font-bold text-xl" style={bodyFont}>{s.n}</span>
                </div>
                <h3 className="font-semibold text-white text-base mb-2" style={bodyFont}>{s.label}</h3>
                <p className="text-sm text-white/60 leading-relaxed" style={bodyFont}>{s.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════════
          EMOTIONAL / VIDEO
      ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 py-14 lg:py-28 grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">

        <div>
          <p className="text-xs tracking-[0.3em] uppercase mb-6" style={{ ...bodyFont, color: "#f0196b" }}>
            A experiência
          </p>
          <h2 className="font-light leading-tight mb-8 text-white/90"
              style={{ ...displayFont, fontSize: "clamp(2rem, 3.5vw, 3rem)" }}>
            Muito mais do que uma música,{" "}
            <em style={{ color: "#f0196b" }}>é uma experiência completa.</em>
          </h2>
          <p className="text-white/90 font-medium mb-5" style={{ ...bodyFont, fontSize: "1.0625rem" }}>
            Tudo incluso:
          </p>
          <div className="space-y-4">
            {[
              "A música é exclusiva e perfeita",
              "As fotos aparecem sincronizadas.",
              "A letra acompanha a reprodução.",
              "O QR Code tem um link exclusivo para surpreender de verdade.",
              "Tudo em um player exclusivo.",
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-3">
                <svg className="shrink-0 mt-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f0196b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p className="text-white/55 leading-relaxed text-sm" style={bodyFont}>{t}</p>
              </div>
            ))}
          </div>
        </div>

        <ExperienceVideo />

      </section>

      {/* ═══════════════════════════════════════════
          POR QUE NOS ESCOLHER
      ═══════════════════════════════════════════ */}
      <section className="border-y border-white/[0.05] py-14 lg:py-28" style={{ background: "rgba(255,255,255,0.015)" }}>
        <div className="max-w-6xl mx-auto px-6">

          <div className="mb-16 max-w-xl">
            <p className="text-xs tracking-[0.3em] uppercase mb-6" style={{ ...bodyFont, color: "#f0196b" }}>
              Diferenciais
            </p>
            <h2 className="font-light text-white/90 leading-tight"
                style={{ ...displayFont, fontSize: "clamp(2rem, 3.5vw, 3rem)" }}>
              Por que escolher<br />
              <em style={{ color: "#f0196b" }}>a Fiz Música?</em>
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {WHY.map((w) => (
              <div key={w.title}
                   className="group relative p-8 rounded-3xl cursor-default"
                   style={{
                     background: "rgba(255,255,255,0.03)",
                     border: "1px solid rgba(255,255,255,0.07)",
                     transition: "transform 0.3s cubic-bezier(.16,1,.3,1), box-shadow 0.3s ease, border-color 0.3s ease",
                   }}
                   onMouseEnter={e => {
                     const el = e.currentTarget
                     el.style.transform = "translateY(-10px) scale(1.02)"
                     el.style.boxShadow = "0 24px 60px rgba(240,25,107,0.22), 0 8px 24px rgba(0,0,0,0.6)"
                     el.style.borderColor = "rgba(240,25,107,0.35)"
                     el.style.background = "rgba(20,18,35,1)"
                     el.style.zIndex = "10"
                   }}
                   onMouseLeave={e => {
                     const el = e.currentTarget
                     el.style.transform = ""
                     el.style.boxShadow = ""
                     el.style.borderColor = "rgba(255,255,255,0.07)"
                     el.style.background = "rgba(255,255,255,0.03)"
                     el.style.zIndex = ""
                   }}>
                {/* glow hover */}
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                     style={{ background: "radial-gradient(ellipse at 30% 0%, rgba(240,25,107,0.08) 0%, transparent 70%)" }} />

                {/* icon badge */}
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-7 text-white"
                     style={{ background: w.gradient, boxShadow: "0 4px 20px rgba(240,25,107,0.25)" }}>
                  {w.icon}
                </div>

                <h3 className="font-semibold text-white text-base mb-3 leading-snug" style={bodyFont}>
                  {w.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ ...bodyFont, color: "rgba(255,255,255,0.45)" }}>
                  {w.desc}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════════
          DIFERENCIAIS PREMIUM (team)
      ═══════════════════════════════════════════ */}
      <section className="relative py-14 lg:py-28 overflow-hidden">
        <div className="pointer-events-none absolute inset-0"
             style={{ background: "radial-gradient(ellipse at 60% 50%, rgba(240,25,107,0.06) 0%, transparent 60%)" }} />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="rounded-3xl overflow-hidden"
               style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(240,25,107,0.1)" }}>

            <div className="grid lg:grid-cols-2">

              {/* left */}
              <div className="p-7 lg:p-14 flex flex-col justify-center space-y-6 lg:space-y-8">
                <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full w-fit text-sm font-medium"
                     style={{ ...bodyFont, background: "rgba(240,25,107,0.1)", border: "1px solid rgba(240,25,107,0.25)", color: "#ff6b9d" }}>
                  <span className="w-2 h-2 rounded-full animate-pulse-ring shrink-0" style={{ background: "#f0196b" }} />
                  O que nos torna únicos
                </div>

                <h2 className="font-light leading-tight text-white/90"
                    style={{ ...displayFont, fontSize: "clamp(2.2rem, 4vw, 3.5rem)" }}>
                  Mais que músicas,{" "}
                  <em style={{ color: "#f0196b" }}>
                    criamos emoções que ficam para sempre.
                  </em>
                </h2>

                <p className="text-sm text-white/60 leading-relaxed max-w-md" style={bodyFont}>
                  Enquanto outras plataformas apenas geram músicas, nós criamos experiências emocionais completas feitas para tocar o coração de quem recebe.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
                      title: "Experiência emocional guiada",
                      grad: "linear-gradient(135deg,#f0196b,#d946ef)",
                    },
                    {
                      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
                      title: "Letras feitas para sua história",
                      grad: "linear-gradient(135deg,#d946ef,#f0196b)",
                    },
                    {
                      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>,
                      title: "Player exclusivo com música, foto e letra.",
                      grad: "linear-gradient(135deg,#f0196b,#d946ef)",
                    },
                    {
                      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
                      title: "Presente inesquecível",
                      grad: "linear-gradient(135deg,#d946ef,#f0196b)",
                    },
                  ].map((b) => (
                    <div key={b.title}
                         className="p-4 rounded-2xl flex items-start gap-3 transition-all duration-200"
                         style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white mt-0.5"
                           style={{ background: b.grad }}>
                        {b.icon}
                      </div>
                      <p className="text-xs text-white/65 leading-snug pt-1" style={bodyFont}>{b.title}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* right */}
              <div className="flex flex-col p-6 lg:relative lg:min-h-[520px] lg:flex lg:items-center lg:justify-center lg:p-10 overflow-hidden">
                {/* glow de fundo — desktop */}
                <div className="pointer-events-none hidden lg:block absolute w-80 h-80 rounded-full blur-[80px]"
                     style={{ background: "rgba(240,25,107,0.18)" }} />
                <div className="pointer-events-none hidden lg:block absolute w-64 h-64 rounded-full blur-[60px] translate-x-16 translate-y-8"
                     style={{ background: "rgba(217,70,239,0.12)" }} />

                {/* moldura gradiente */}
                <div className="relative z-10 p-[2px] rounded-[28px] mb-4 lg:mb-0"
                     style={{ background: "linear-gradient(135deg, #f0196b 0%, #d946ef 50%, rgba(255,255,255,0.08) 100%)" }}>
                  <div className="rounded-[26px] overflow-hidden"
                       style={{ background: "#07060d" }}>
                    <img
                      src="/time_fizmusica.png"
                      alt="Time Fiz Música"
                      className="w-full max-w-sm h-auto object-cover block"
                      style={{
                        filter: "brightness(1.05) contrast(1.05)",
                        maxHeight: "380px",
                        objectPosition: "top",
                      }}
                    />
                  </div>
                </div>

                {/* badge missão — mobile: inline, desktop: absolute */}
                <div className="lg:absolute lg:bottom-8 lg:left-8 lg:right-8 z-20 p-4 lg:p-5 rounded-2xl"
                     style={{ background: "rgba(7,6,13,0.9)", backdropFilter: "blur(24px)", border: "1px solid rgba(240,25,107,0.15)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#f0196b" }} />
                    <p className="text-xs text-white/60" style={bodyFont}>Nossa missão</p>
                  </div>
                  <p className="font-medium text-white/90 leading-snug text-sm" style={bodyFont}>
                    Fazer parte das histórias mais importantes da sua vida ❤️
                  </p>
                </div>
              </div>

            </div>


          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FAQ
      ═══════════════════════════════════════════ */}
      <section className="border-t border-white/[0.05] py-14 lg:py-28" style={{ background: "rgba(255,255,255,0.015)" }}>
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-10 lg:gap-16">

          {/* Coluna esquerda — fixa: título + suporte */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ ...bodyFont, color: "#f0196b" }}>
              Dúvidas frequentes
            </p>
            <h2 className="font-light text-white/90 leading-tight"
                style={{ ...displayFont, fontSize: "clamp(2rem, 3.5vw, 3rem)" }}>
              Tudo que você precisa saber<br />
              <em style={{ color: "#f0196b" }}>antes de emocionar alguém.</em>
            </h2>

            {/* Card de suporte */}
            <div className="mt-8 rounded-3xl p-6"
                 style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(240,25,107,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💬</span>
                <p className="font-semibold text-white text-sm" style={bodyFont}>Não achou sua dúvida?</p>
              </div>
              <p className="text-sm text-white/55 leading-relaxed mb-5" style={bodyFont}>
                Nossa equipe responde rápido e com carinho. Fale com a gente — estamos sempre à disposição. ❤️
              </p>
              <a
                href="https://wa.me/5511996645678?text=Ol%C3%A1!%20Tenho%20uma%20d%C3%BAvida%20sobre%20a%20Fiz%20M%C3%BAsica."
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 transition-all py-3 rounded-xl text-sm font-semibold text-white"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Falar no WhatsApp
              </a>
            </div>
          </div>

          {/* Coluna direita — acordeão */}
          <div className="min-w-0">
            <FaqHome />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          CTA FINAL
      ═══════════════════════════════════════════ */}
      <section className="max-w-4xl mx-auto px-6 py-14 lg:py-28 text-center">
        <div className="relative overflow-hidden rounded-3xl p-8 lg:p-14"
             style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(240,25,107,0.12)" }}>
          <div className="pointer-events-none absolute inset-0"
               style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(240,25,107,0.1) 0%, transparent 65%)" }} />

          <div className="relative space-y-7">
            <p className="text-xs tracking-[0.3em] uppercase" style={{ ...bodyFont, color: "#f0196b" }}>
              Comece agora
            </p>
            <h2 className="font-light text-white/90 leading-tight"
                style={{ ...displayFont, fontSize: "clamp(2.5rem, 5vw, 4.5rem)" }}>
              Emocione agora<br />
              <em style={{ color: "#f0196b" }}>quem você ama.</em>
            </h2>
            <p className="text-white/60 text-sm max-w-sm mx-auto leading-relaxed" style={bodyFont}>
              Fácil, rápido e completamente personalizado. Será único e inesquecível.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => { track("cta_criar", "home"); router.push("/criar") }}
                className="text-white px-8 py-3.5 rounded-xl transition-all duration-200 hover:brightness-110 active:scale-[0.97] shadow-[0_6px_28px_rgba(240,25,107,0.4)]"
                style={{
                  ...bodyFont,
                  background: "linear-gradient(135deg, #f0196b 0%, #d946ef 100%)",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  boxShadow: "0 8px 32px rgba(240,25,107,0.4)",
                }}
              >
                Criar minha música ❤️
              </button>
              <button
                onClick={() => router.push("/quem-somos")}
                className="px-8 py-3.5 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-colors"
                style={{ ...bodyFont, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Quem somos →
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

