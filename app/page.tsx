"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import FizMusicaCarousel from "./components/FizMusicaCarousel"
import Header from "./components/Header"
import Footer from "./components/Footer"

const DEMOS = [
  { id: "namoro",    src: "/namoro_2anos.mp3",          title: "Homenagem Dia dos Namorados", meta: "Maria Eduarda · Sertanejo romântico · 3:12", emoji: "💖" },
  { id: "casamento", src: "/aniversario_casamento.mp3", title: "Aniversário de Casamento",     meta: 'Patricia "Mô" · Pagode romântico · 2:58',  emoji: "💍" },
  { id: "revelacao", src: "/cha_revelacao_menina.mp3",  title: "Chá Revelação",                meta: "É Menina · Sertanejo animado · 3:34",       emoji: "🎀" },
  { id: "pet",       src: "/despedida_pet.mp3",         title: "Despedida — Amora",            meta: "MPB sentimental · 3:20",                    emoji: "🐾" },
]

const STEPS = [
  { n: "1", label: "Conte sua história",    desc: "Escolha a ocasião e preencha o questionário guiado." },
  { n: "2", label: "Escolha o estilo",       desc: "Sertanejo, MPB, pagode, pop — você decide." },
  { n: "3", label: "Receba no WhatsApp",     desc: "Sua música chega direto no seu celular." },
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
    desc: "Revisão rigorosa. Nada genérico — cada detalhe inspira a composição.",
    gradient: "linear-gradient(135deg, #d946ef, #f0196b)",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    title: "Plataforma premium assistida",
    desc: "Nossa equipe acompanha você do início ao fim via WhatsApp.",
    gradient: "linear-gradient(135deg, #f0196b, #d946ef)",
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
    <div className="noise min-h-screen text-white" style={{ backgroundColor: "#07060d", ...bodyFont }}>
      <Header />

      {/* ═══════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════ */}
      <section className="relative lg:min-h-screen flex items-center overflow-hidden pt-20 lg:pt-24">

        {/* ambient orbs */}
        <div className="animate-orb pointer-events-none absolute -top-32 -left-32 w-[700px] h-[700px] rounded-full"
             style={{ background: "radial-gradient(circle, rgba(240,25,107,0.08) 0%, transparent 70%)" }} />
        <div className="animate-orb pointer-events-none absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full delay-700"
             style={{ background: "radial-gradient(circle, rgba(217,70,239,0.06) 0%, transparent 70%)", animationDelay: "6s" }} />

        <div className="relative max-w-6xl mx-auto px-6 py-8 lg:py-20 w-full grid lg:grid-cols-[1fr_420px] gap-8 lg:gap-16 xl:gap-24 items-start">

          {/* ── copy ── */}
          <div>
            <p className="animate-fade-up delay-100 text-[#f0196b] text-xs font-medium tracking-[0.3em] uppercase mb-8"
               style={bodyFont}>
              Músicas personalizadas
            </p>

            <h1 className="animate-fade-up delay-200 leading-[0.95] mb-8" style={displayFont}>
              <span className="block font-light text-white/90"
                    style={{ fontSize: "clamp(3rem, 7vw, 6.5rem)" }}>
                Existem histórias
              </span>
              <span className="block font-light text-white/90"
                    style={{ fontSize: "clamp(3rem, 7vw, 6.5rem)" }}>
                que merecem ser
              </span>
              <em className="block font-semibold not-italic"
                  style={{ fontSize: "clamp(3.2rem, 7.5vw, 7rem)", color: "#f0196b" }}>
                cantadas.
              </em>
            </h1>

            <p className="animate-fade-up delay-300 text-white/50 leading-relaxed mb-10 max-w-sm"
               style={{ ...bodyFont, fontSize: "1rem" }}>
              Crie uma música 100% personalizada e emocione quem você ama com um presente verdadeiramente único.
            </p>

            <div className="animate-fade-up delay-400 flex flex-wrap gap-3 mb-10">
              <button
                onClick={() => router.push("/criar")}
                className="text-white px-7 py-3.5 rounded-xl transition-all duration-200 hover:brightness-110 active:scale-[0.97] shadow-[0_6px_24px_rgba(240,25,107,0.35)]"
                style={{
                  ...bodyFont,
                  background: "#f0196b",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  letterSpacing: "0.03em",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                Criar minha música
              </button>
            </div>

            <div className="animate-fade-up delay-500 flex flex-wrap gap-6 text-xs text-white/55 tracking-wide"
                 style={bodyFont}>
              {[
                { label: "Presente único", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg> },
                { label: "Entrega via WhatsApp", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> },
                { label: "Pagamento seguro", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
              ].map(({ label, icon }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span style={{ color: "#f0196b" }}>{icon}</span> {label}
                </span>
              ))}
            </div>
          </div>

          {/* ── player ── */}
          <div className="animate-fade-up delay-400 lg:pt-16">

            {/* Logo com glow ambiente */}
            <div className="hidden lg:flex relative mb-14 items-center justify-center">
              <div className="pointer-events-none absolute w-64 h-32 rounded-full blur-[60px] opacity-50"
                   style={{ background: "radial-gradient(ellipse, #f0196b 0%, transparent 70%)" }} />
              <div className="pointer-events-none absolute w-48 h-28 rounded-full blur-[50px] opacity-35 translate-x-8"
                   style={{ background: "radial-gradient(ellipse, #d946ef 0%, transparent 70%)" }} />
              <img src="/logo_fizmusica.png" alt="Fiz Música" className="relative z-10 h-48 w-auto" />
            </div>

            <div className="animate-float rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
                 style={{ background: "linear-gradient(160deg, rgba(240,25,107,0.18) 0%, rgba(217,70,239,0.12) 50%, rgba(255,255,255,0.03) 100%)", border: "1px solid rgba(240,25,107,0.2)", backdropFilter: "blur(24px)" }}>

              {/* header card */}
              <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]"
                   style={{ background: "linear-gradient(135deg, #f0196b 0%, #d946ef 100%)" }}>
                <p className="font-semibold text-base mb-0.5" style={displayFont}>
                  Escute agora algumas histórias:
                </p>
                <p className="text-white/75 text-xs" style={bodyFont}>
                  Exemplos reais criados para nossos clientes
                </p>
              </div>

              {/* tracks */}
              <div className="space-y-0 p-2">
                {DEMOS.map((d, idx) => {
                  const isActive = currentAudio === d.src && playing
                  return (
                    <button
                      key={d.id}
                      onClick={() => togglePlay(d.src)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 group"
                      style={{
                        background: isActive ? "rgba(240,25,107,0.15)" : "rgba(255,255,255,0.03)",
                      }}
                    >
                      {/* track number */}
                      <span
                        className="shrink-0 w-6 text-center tabular-nums"
                        style={{ ...bodyFont, fontSize: "0.7rem", color: isActive ? "rgba(240,25,107,0.8)" : "rgba(255,255,255,0.25)" }}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>

                      {/* text */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="truncate leading-snug"
                          style={{
                            ...bodyFont,
                            fontSize: "0.8125rem",
                            fontWeight: 500,
                            color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)",
                            letterSpacing: "0.01em",
                          }}
                        >
                          {d.title}
                        </p>
                        <p
                          className="truncate mt-0.5"
                          style={{
                            ...bodyFont,
                            fontSize: "0.68rem",
                            color: isActive ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.4)",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {d.meta}
                        </p>
                      </div>

                      {/* play button */}
                      <div
                        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
                        style={{
                          background: isActive
                            ? "#f0196b"
                            : "rgba(255,255,255,0.07)",
                          boxShadow: isActive
                            ? "0 0 18px rgba(240,25,107,0.55), 0 0 6px rgba(240,25,107,0.3)"
                            : "none",
                          border: `1px solid ${isActive ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.1)"}`,
                        }}
                      >
                        {isActive ? (
                          /* pause icon */
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                            <rect x="2" y="1" width="3" height="10" rx="1"/>
                            <rect x="7" y="1" width="3" height="10" rx="1"/>
                          </svg>
                        ) : (
                          /* play icon SVG — slightly offset right for optical centering */
                          <svg width="11" height="12" viewBox="0 0 11 12" fill="none" style={{ marginLeft: "1px" }}>
                            <path d="M1 1.5L10 6L1 10.5V1.5Z" fill="rgba(255,255,255,0.7)" stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              <audio
                ref={audioRef}
                onEnded={() => { setPlaying(false); setCurrentAudio(null) }}
              />
            </div>

          </div>

        </div>
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
              <em style={{ color: "#f0196b" }}>sua história vira música.</em>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            Veja a emoção de transformar{" "}
            <em style={{ color: "#f0196b" }}>sentimentos em música.</em>
          </h2>
          <div className="space-y-5">
            {[
              "Imagine a reação ao ouvir uma música feita especialmente para ela.",
              "Mais do que um presente — uma lembrança para a vida toda.",
              "Nós te entregamos emoção e amor em cada nota.",
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="shrink-0 w-px h-12 mt-1 rounded-full" style={{ background: "rgba(240,25,107,0.3)" }} />
                <p className="text-white/55 leading-relaxed text-sm" style={bodyFont}>{t}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative rounded-3xl overflow-hidden aspect-video flex items-center justify-center cursor-pointer group"
             style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="absolute inset-0"
               style={{ background: "linear-gradient(135deg, rgba(240,25,107,0.1) 0%, rgba(217,70,239,0.06) 100%)" }} />
          <div className="relative w-16 h-16 rounded-full flex items-center justify-center text-xl transition-all duration-300 group-hover:scale-110"
               style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
            ▶
          </div>
        </div>

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

          <div className="grid lg:grid-cols-3 gap-5">
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
                      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
                      title: "Atendimento humanizado",
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
              <div className="relative min-h-[320px] lg:min-h-[520px] flex items-center justify-center p-6 lg:p-10 overflow-hidden">
                {/* glow de fundo */}
                <div className="pointer-events-none absolute w-80 h-80 rounded-full blur-[80px]"
                     style={{ background: "rgba(240,25,107,0.18)" }} />
                <div className="pointer-events-none absolute w-64 h-64 rounded-full blur-[60px] translate-x-16 translate-y-8"
                     style={{ background: "rgba(217,70,239,0.12)" }} />

                {/* moldura gradiente */}
                <div className="relative z-10 p-[2px] rounded-[28px]"
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

                {/* badge missão */}
                <div className="absolute bottom-8 left-8 right-8 z-20 p-5 rounded-2xl"
                     style={{ background: "rgba(7,6,13,0.9)", backdropFilter: "blur(24px)", border: "1px solid rgba(240,25,107,0.15)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f0196b" }} />
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
            <div className="pt-2">
              <button
                onClick={() => router.push("/criar")}
                className="text-white px-8 py-3.5 rounded-xl transition-all duration-200 hover:brightness-110 active:scale-[0.97] shadow-[0_6px_28px_rgba(240,25,107,0.4)]"
                style={{
                  ...bodyFont,
                  background: "#f0196b",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                Criar minha música
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

