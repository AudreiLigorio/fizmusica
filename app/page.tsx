"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { track } from "@/lib/track"
import { useRouter } from "next/navigation"
import FizMusicaCarousel from "./components/FizMusicaCarousel"
import Header from "./components/Header"
import Footer from "./components/Footer"
import BarraHome, { TabsHomeDesktop } from "./components/BarraHome"
import ExperienceVideo from "./components/ExperienceVideo"
import VideoExemplos from "./components/VideoExemplos"
import ProdutosCarrossel from "./components/ProdutosCarrossel"
import FaqHome from "./components/FaqHome"
import ResumeMusicBanner from "./components/ResumeMusicBanner"
import FizMascot from "./components/FizMascot"

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

// Pedido do Audrei: o passo 3 antigo ("É só adicionar as suas fotos")
// descrevia um fluxo que não existe mais — as fotos entram DEPOIS do
// pagamento, na área do cliente (ver comentário no redirect final do
// wizard, mais abaixo). Reescrito pra bater com o wizard real: ocasião
// (inclui "composição livre" como opção, não só homenagem) → estilo →
// dados do produto escolhido → pronto.
const STEPS = [
  { n: "1", label: "Escolha a ocasião",       desc: "Composição livre ou homenagem — você define, contando pra quem é." },
  { n: "2", label: "Defina o estilo musical", desc: "Sertanejo, MPB, pagode, pop — você decide." },
  { n: "3", label: "Informe os dados do produto", desc: "Preencha de acordo com o que você escolheu — capa, fotos, QR Code." },
  { n: "4", label: "Pronto em minutos",       desc: "Sua história vira música rapidinho, sem complicação." },
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

// Dispara uma vez quando o elemento entra na tela — usado pra animar a
// entrada de "Como funciona" (cartões + linha conectando os números) só
// quando a pessoa rola até lá, em vez de tocar a animação inteira antes
// de qualquer um ver (a seção fica bem abaixo da dobra).
function useInView(threshold = 0.25) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect() } },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return { ref, inView }
}

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

  // Animação de entrada de "Como funciona" — dispara quando a seção aparece.
  const { ref: stepsRef, inView: stepsInView } = useInView()
  // Número de marketing, NÃO vem do banco — decisão explícita do Audrei em
  // 2026-09-02 ("publicar 2361 músicas criadas. é fictício mesmo"), depois
  // de eu mostrar o número real (68 entregues) e ele pedir pra inflar mesmo
  // assim. Registrado aqui pra quem ler o código depois não achar que isto
  // é uma consulta ao banco — não é.
  const { ref: statRef, value: statValue } = useCountUp(2361, 0, 1600)

  // Linha que conecta os 4 números de "Como funciona": MEDIDA, não em
  // porcentagem fixa. O badge não fica centralizado na coluna do grid —
  // o `p-8` do cartão empurra o círculo pra perto da borda esquerda —
  // então "12.5% a 87.5%" (os centros de uma grade de 4 colunas) erraria
  // o alvo. Mede o centro real do 1º e do último badge e recalcula no
  // resize, porque esse deslocamento muda com a largura da tela.
  const [lineSpan, setLineSpan] = useState<{ left: number; width: number } | null>(null)
  const badgeRefs = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => {
    function medir() {
      const wrap = stepsRef.current
      const first = badgeRefs.current[0]
      const last = badgeRefs.current[STEPS.length - 1]
      if (!wrap || !first || !last) return
      const wrapRect = wrap.getBoundingClientRect()
      const firstRect = first.getBoundingClientRect()
      const lastRect = last.getBoundingClientRect()
      const firstCenter = (firstRect.left + firstRect.right) / 2 - wrapRect.left
      const lastCenter = (lastRect.left + lastRect.right) / 2 - wrapRect.left
      setLineSpan({ left: firstCenter, width: lastCenter - firstCenter })
    }
    medir()
    window.addEventListener("resize", medir)
    return () => window.removeEventListener("resize", medir)
  }, [stepsRef])

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

      {/* Abas também na home, no DESKTOP. O componente existia desde a Fase 1
          mas nunca tinha sido montado: no celular a barra fica no rodapé
          (BarraHome, mais abaixo), e no desktop a home simplesmente não tinha
          navegação nenhuma — quem entrava pelo computador não via que existem
          Pedidos, Músicas e Carreira.
          `hidden sm:block` porque o rodapé mobile já cumpre esse papel; o
          pedido do Audrei foi explícito em não mexer no mobile. */}
      {/* pt-24: o Header é `fixed`, então sem esse respiro as abas nascem
          POR BAIXO dele (foi o que aconteceu na primeira tentativa — só
          aparecia um risquinho do sublinhado da aba ativa). Mesmo valor que
          a área do cliente usa. */}
      <div className="hidden sm:block pt-24 pb-2">
        <TabsHomeDesktop />
      </div>

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

        {/* conteúdo sobreposto. pt-28 no mobile limpa o header FIXO (não tem
            mais nada acima do hero lá — `hidden sm:block` faz TabsHomeDesktop
            sumir nessa largura). Do sm pra cima esse espaço já foi aberto
            pelo wrapper `pt-24` da barra de abas (linha ~203) — manter o
            pt-36 aqui somava os dois respiros e afastava o título do topo
            bem mais do que o previsto (era 144px de sobra, não decoração). */}
        <div className="relative z-20 max-w-6xl mx-auto px-6 pt-28 sm:pt-8 lg:pt-10 pb-16 lg:pb-14 w-full">

          {/* Linha de cima: texto à esquerda, colagem à direita.
              GRADE de verdade, não mais `position:absolute`. Enquanto a
              colagem era absoluta ela não ocupava espaço nenhum, então a
              altura da seção ignorava a imagem e ela vazava pro rodapé —
              foi o bug de 40px de `5ec25f4`. Na grade, a imagem participa
              da altura e nunca mais pode transbordar. */}
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,54%)] lg:gap-6 lg:items-center">

            <div className="max-w-xl">
            {/* Aqui existia o rótulo "MÚSICAS PERSONALIZADAS" em caixa alta.
                Saiu a pedido do Audrei. Os delays das linhas abaixo subiram
                um degrau junto (200→100 e assim por diante): mantidos como
                estavam, a entrada abriria com 200ms de tela parada, porque a
                peça que ocupava o primeiro tempo da sequência não existe
                mais. */}
            {/* Mesma fonte e mesmas cores da vitrine de produtos (pedido do
                Audrei): DM Sans extrabold em caixa alta, primeira linha
                branca e segunda no degradê rosa→roxo. Antes era a serifada
                (Cormorant) com o rosa chapado.

                A segunda linha usa `drop-shadow` em vez de `text-shadow`:
                com o degradê a letra fica `color: transparent` e o texto
                aparece pelo `background-clip`, então `text-shadow` desenharia
                a sombra a partir da silhueta e sujaria o degradê. O
                `drop-shadow` age sobre o que foi realmente pintado. Sombra é
                necessária nas duas: o texto fica sobre vídeo em movimento. */}
            <h1 className="animate-fade-up delay-100 font-extrabold uppercase leading-[0.98] tracking-tight mb-7" style={bodyFont}>
              <span className="block text-white" style={{ fontSize: "clamp(1.9rem, 3.6vw, 3rem)", textShadow: "0 2px 30px rgba(0,0,0,0.6)" }}>
                Aqui você escolhe
              </span>
              <span
                className="block"
                style={{
                  fontSize: "clamp(2.1rem, 4vw, 3.3rem)",
                  background: "linear-gradient(90deg,#f0196b,#d946ef)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  filter: "drop-shadow(0 2px 18px rgba(0,0,0,0.55))",
                }}
              >
                como quer viver essa experiência.
              </span>
            </h1>

            <p className="animate-fade-up delay-200 text-white/60 leading-relaxed mb-9 max-w-sm" style={{ ...bodyFont, fontSize: "1rem", textShadow: "0 1px 12px rgba(0,0,0,0.6)" }}>
              Pode ser apenas uma música que emociona, ou uma experiência completa com fotos sincronizadas, capa exclusiva e QR Code.
            </p>

            <div className="animate-fade-up delay-300 flex flex-wrap gap-3 mb-9">
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
            </div>

            {/* Colagem "Player Exclusivo". Só desktop (versão web): no
                celular ela competiria com o próprio vídeo, que já mostra
                fotos flutuando.

                Margens PAREADAS (`ml-N` positiva + `-mr-N` igual) pra
                empurrar a arte pra direita e liberar a mulher com o celular
                do vídeo, que ela cobria (pedido do Audrei). Só a negativa
                não resolvia: ela estica a caixa pra direita e a borda
                ESQUERDA fica onde estava — a arte engordava em vez de
                andar. Com as duas, a largura se mantém (−ml +mr se anulam)
                e o bloco inteiro desloca.

                O passo cresce com a tela porque o teto é a margem que sobra
                entre o container (max-w-6xl, 1152px) e a borda: 24px até
                1279 (o próprio `px-6`), 64px a partir de 1280, 192px a
                partir de 1536. Passar do teto corta a arte — com -40px ela
                vazava 16px em 1024, escondidos pelo overflow da seção.

                Os valores estão quase colados no teto de cada faixa (56 de
                64, 160 de 192) pra revelar o celular com o efeito saindo.
                Até 1279 não dá pra ir além: lá o teto de 24px já está em
                uso e a arte encosta na borda.

                Envelope + imagem separados de propósito: `animate-fade-up`
                anima `transform`, então qualquer transform de layout no
                MESMO elemento seria apagado por ele (ver 5ec25f4). */}
            <div aria-hidden="true" className="hidden lg:block pointer-events-none select-none lg:ml-6 lg:-mr-6 xl:ml-14 xl:-mr-14 2xl:ml-40 2xl:-mr-40">
              <Image
                src="/decor/hero-colagem.webp"
                alt=""
                width={1400}
                height={933}
                priority
                // Sem `sizes` o navegador não sabe o tamanho de exibição e
                // baixava a maior variante (w=3840, 223KB) pra desenhar
                // ~680px. Com ele pede a faixa certa. O `1px` abaixo de
                // 1024 é intencional: a arte é `hidden` no celular, mas o
                // navegador baixa mesmo assim — assim ele baixa a menor
                // variante possível em vez do arquivo cheio.
                sizes="(min-width: 1024px) 54vw, 1px"
                className="animate-fade-up delay-400 w-full h-auto"
                style={{ filter: "drop-shadow(0 20px 50px rgba(0,0,0,0.55))" }}
              />
            </div>
          </div>

          {/* Selos em faixa de largura INTEIRA, abaixo das duas colunas
              (pedido do Audrei: usar o lado direito também). Antes viviam
              dentro do `max-w-xl` do texto, onde 9 itens quebravam em 3
              fileiras irregulares — o desalinho é o que dava ar de amador.
              Grade de colunas iguais em vez de `flex-wrap`: assim as
              fileiras batem umas com as outras em vez de terminarem cada
              uma num ponto. */}
          {/* Fonte maior (14px) a partir do desktop — pedido do Audrei: em
              12px sobre vídeo em movimento a leitura sofria. Contraste subiu
              junto (white/70 → white/85) pela mesma razão: fundo animado
              exige mais separação que fundo chapado.

              No CELULAR fica em 12px de propósito. Lá as colunas têm ~150px,
              e com 14px os rótulos longos passavam a quebrar em TRÊS linhas
              — o último selo chegava a sumir atrás da barra de navegação.
              Aumentar a fonte tornava a lista menos legível, não mais. */}
          <div className="animate-fade-up delay-400 mt-10 lg:mt-12 pt-6 border-t border-white/10 grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-xs lg:text-sm text-white/85 tracking-wide" style={bodyFont}>
              {[
                // Mesmos ícones da /produtos (música e QR Code), pra selo e
                // cartão de produto lerem como a mesma linguagem visual.
                { label: "Música de alta qualidade", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
                { label: "Retrospectiva com fotos sincronizadas", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
                { label: "QR Code para presentear", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="15" y="15" width="5" height="5"/></svg> },
                { label: "Ajustes e revisões", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg> },
                { label: "2ª versão grátis", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> },
                { label: "Tudo em minutos", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg> },
                { label: "Player exclusivo", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5Z" fill="currentColor" stroke="none"/></svg> },
                { label: "Letra sincronizada", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h10M4 18h13"/></svg> },
                { label: "Publicação gratuita na Rede Fiz Música", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.4M15.4 6.6 8.6 10.5"/></svg> },
            ].map(({ label, icon }) => (
              // `items-start` + `shrink-0`: em coluna estreita o rótulo
              // longo quebra em duas linhas, e sem isso o ícone escorregaria
              // pro meio do bloco de texto ou seria espremido.
              <span key={label} className="flex items-start gap-2 leading-snug">
                <span className="shrink-0 mt-0.5" style={{ color: "#ff3d84" }}>{icon}</span> {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          PRODUTOS E PREÇOS — vitrine antes dos exemplos
      ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 pt-14 lg:pt-20">
        <ProdutosCarrossel />
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
      <section className="max-w-3xl lg:max-w-5xl mx-auto px-6 py-14 lg:py-20">
        {/* Mesma lógica do cabeçalho de exemplos em vídeo (pedido do
            Audrei): selo removido, título passa da serifada (Cormorant)
            pra DM Sans extrabold em caixa alta, quebrado em duas linhas
            com a 2ª no degradê rosa→roxo. Sem vírgula natural pra quebrar
            desta vez ("Ouça como ficam as músicas" é uma frase corrida),
            então a quebra fica entre verbo+advérbio e o objeto — mesmo
            equilíbrio de peso das duas linhas dos outros títulos. */}
        <div className="max-w-3xl mx-auto text-center mb-8">
          <h2 className="font-extrabold uppercase leading-[0.98] tracking-tight" style={bodyFont}>
            <span className="block text-white/90" style={{ fontSize: "clamp(1.7rem, 3.4vw, 2.5rem)" }}>
              Ouça como ficam
            </span>
            <span className="block" style={{ fontSize: "clamp(1.7rem, 3.4vw, 2.5rem)", background: "linear-gradient(90deg,#f0196b,#d946ef)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              as músicas
            </span>
          </h2>
          <p className="text-white/50 text-sm mt-3" style={bodyFont}>
            Músicas reais já entregues — a sua será única e personalizada.
          </p>
        </div>

        {/* Lista + convite lado a lado na web (pedido do Audrei — só na
            web, o celular continua empilhado, que já era o layout natural
            aqui). `lg:items-stretch` faz as duas colunas terem a MESMA
            altura, senão o cartão mais curto ficava com um vão vazio ao
            lado do mais alto. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,42%)_minmax(0,1fr)] lg:gap-6 lg:items-stretch">

        {/* Encolhida (pedido do Audrei): era um cartão largo com bastante
            respiro por linha (py-3.5, ícone de 36px). `max-w-xl` centraliza
            a lista num corpo mais compacto no celular — um mini-player, não
            uma tabela. No desktop ela é a coluna esquerda da grade acima,
            então perde o `max-w-xl`/centralização própria (`lg:max-w-none
            lg:mx-0`) pra preencher a coluna inteira. */}
        <div className="max-w-xl mx-auto lg:max-w-none lg:mx-0 lg:h-full rounded-3xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
             style={{ background: "linear-gradient(160deg, rgba(240,25,107,0.14) 0%, rgba(217,70,239,0.10) 50%, rgba(255,255,255,0.03) 100%)", border: "1px solid rgba(240,25,107,0.2)", backdropFilter: "blur(24px)" }}>
          <div className="space-y-0 p-1.5">
            {DEMOS.map((d, idx) => {
              const isActive = currentAudio === d.src && playing
              return (
                <button
                  key={d.id}
                  onClick={() => togglePlay(d.src)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group"
                  style={{ background: isActive ? "rgba(240,25,107,0.15)" : "rgba(255,255,255,0.03)" }}
                >
                  <span className="shrink-0 w-5 text-center tabular-nums"
                        style={{ ...bodyFont, fontSize: "0.68rem", color: isActive ? "rgba(240,25,107,0.8)" : "rgba(255,255,255,0.25)" }}>
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate leading-snug"
                       style={{ ...bodyFont, fontSize: "0.82rem", fontWeight: 500, color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)" }}>
                      {d.emoji} {d.title}
                    </p>
                    <p className="truncate" style={{ ...bodyFont, fontSize: "0.68rem", color: isActive ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.4)" }}>
                      {d.meta}
                    </p>
                  </div>
                  <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
                       style={{
                         background: isActive ? "#f0196b" : "rgba(255,255,255,0.07)",
                         boxShadow: isActive ? "0 0 18px rgba(240,25,107,0.55)" : "none",
                         border: `1px solid ${isActive ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.1)"}`,
                       }}>
                    {isActive ? (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="white">
                        <rect x="2" y="1" width="3" height="10" rx="1"/><rect x="7" y="1" width="3" height="10" rx="1"/>
                      </svg>
                    ) : (
                      <svg width="10" height="11" viewBox="0 0 11 12" fill="none" style={{ marginLeft: "1px" }}>
                        <path d="M1 1.5L10 6L1 10.5V1.5Z" fill="rgba(255,255,255,0.7)" stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Convite pra Rede Fiz Música (pedido do Audrei): quem acabou de
            ouvir 4 exemplos está no clima certo pra descobrir que existe
            uma rede inteira de músicas publicadas por outros clientes —
            não é só o catálogo fixo acima. Mascote "Fiz" (arara com fones,
            ver FizMascot.tsx) dançando puxa o tom de "divirta-se", igual ao
            resto da marca.

            Empilhado no celular e no tablet (`flex-col sm:flex-row`
            controla só o CONTEÚDO interno do cartão — mascote/texto/botão
            em linha a partir de 640px). No desktop o cartão vira a coluna
            direita da grade acima; como essa coluna fica mais estreita que
            a largura cheia de antes, o conteúdo interno volta a empilhar
            em coluna (`lg:flex-col`) e centraliza (`lg:text-center`) — do
            jeito que ficava no celular — em vez de espremer mascote, texto
            e botão numa linha só que não cabe mais. `lg:justify-center`
            centraliza verticalmente: a coluna da lista ao lado dita a
            altura (`items-stretch` no grid), e sem isso o conteúdo ficaria
            grudado no topo com um vão vazio embaixo. */}
        <div className="relative mt-6 lg:mt-0 lg:h-full rounded-3xl overflow-hidden">
          <div className="absolute inset-0"
               style={{ background: "radial-gradient(130% 160% at 12% 15%, rgba(240,25,107,0.38) 0%, transparent 55%), radial-gradient(130% 160% at 88% 85%, rgba(139,92,246,0.38) 0%, transparent 55%), #14111f" }} />
          <div className="absolute inset-0 opacity-40"
               style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "22px 22px", maskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)" }} />

          <div className="relative flex flex-col sm:flex-row lg:flex-col items-center justify-center gap-1 sm:gap-6 lg:gap-1 h-full px-6 pt-2 pb-7 sm:py-8 text-center sm:text-left lg:text-center">
            <div className="shrink-0 -mt-4 sm:mt-0 lg:mt-0 pointer-events-none select-none">
              <FizMascot mood="energetic" size={104} />
            </div>

            <div className="flex-1 lg:flex-none min-w-0">
              <p className="font-extrabold leading-tight" style={{ ...bodyFont, fontSize: "clamp(1.35rem, 3.2vw, 1.75rem)" }}>
                <span className="text-white">Divirta-se ouvindo</span>{" "}
                <span style={{ background: "linear-gradient(90deg,#f0196b,#d946ef)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                  Fiz Música
                </span>
              </p>
              <p className="text-white/60 text-sm mt-2 max-w-sm mx-auto sm:mx-0 lg:mx-auto" style={bodyFont}>
                Explore a Rede Fiz Música: histórias reais que outros clientes escolheram publicar, e também música de quem quer compor e criar na prática. Curta, favorite e monte sua playlist.
              </p>
            </div>

            <button
              onClick={() => { track("cta_rede", "home_player_exemplos"); router.push("/minha-musica?aba=musicas") }}
              className="shrink-0 mt-1 sm:mt-0 lg:mt-3 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)", boxShadow: "0 8px 26px rgba(240,25,107,0.35)" }}
            >
              Ouvir a Rede
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
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

          {/* Mesma lógica dos outros títulos (pedido do Audrei): selo
              removido, fonte passa da serifada (Cormorant) pra DM Sans
              extrabold em caixa alta, 2ª linha no degradê rosa→roxo. */}
          <div className="mb-16">
            <h2 className="font-extrabold uppercase leading-[0.98] tracking-tight" style={bodyFont}>
              <span className="block text-white/90" style={{ fontSize: "clamp(1.9rem, 3.6vw, 3rem)" }}>
                Em apenas alguns passos,
              </span>
              <span className="block" style={{ fontSize: "clamp(1.9rem, 3.6vw, 3rem)", background: "linear-gradient(90deg,#f0196b,#d946ef)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                sua ideia vira realidade.
              </span>
            </h2>
          </div>

          {/* `stepsRef` no container: dispara a entrada (linha + cartões)
              quando a seção aparece na tela, uma vez só. */}
          <div ref={stepsRef} className="relative">
            {/* Linha conectando os números — só desktop (no celular os
                cartões quebram em 2 colunas, uma linha reta não bate com
                nenhum centro de badge). `top: 56px` é exato (p-8 do cartão
                + metade de w-12 = 32+24), mas `left`/`width` vêm MEDIDOS
                (ver `lineSpan` acima) — o badge não fica centralizado na
                coluna, então uma % fixa erraria o alvo horizontal. */}
            {lineSpan && (
              <div aria-hidden="true" className="hidden lg:block absolute h-px origin-left"
                   style={{
                     top: "56px",
                     left: lineSpan.left,
                     width: lineSpan.width,
                     background: "linear-gradient(90deg, rgba(240,25,107,0.7), rgba(217,70,239,0.7))",
                     transform: stepsInView ? "scaleX(1)" : "scaleX(0)",
                     transition: "transform 1.2s cubic-bezier(.16,1,.3,1) 0.2s",
                   }} />
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {STEPS.map((s, i) => (
                // Envelope SÓ da animação de entrada (opacity/translateY via
                // React, escalonado por índice). O hover continua no cartão
                // de dentro, intocado — e não colide: o hover só mexe em
                // transform/boxShadow/borderColor/background por DOM direto
                // (onMouseEnter/Leave), nunca em opacity, que é quem esta
                // camada controla.
                <div key={s.n}
                     style={{
                       opacity: stepsInView ? 1 : 0,
                       transform: stepsInView ? "translateY(0)" : "translateY(24px)",
                       transition: `opacity 0.7s cubic-bezier(.16,1,.3,1) ${i * 0.12}s, transform 0.7s cubic-bezier(.16,1,.3,1) ${i * 0.12}s`,
                     }}>
                  <div className="group relative h-full p-8 rounded-3xl cursor-default"
                       // `h-full`: a descrição do passo 3 ficou mais longa
                       // ("Preencha de acordo com o que você escolheu — capa,
                       // fotos, QR Code.") e passou a quebrar em mais linhas
                       // que as outras — sem isso, a CAIXA (fundo/borda) de
                       // cada cartão só tinha a altura do próprio texto, e a
                       // fileira ficava com alturas desiguais mesmo o grid
                       // já esticando o envelope-pai por igual (esticar o pai
                       // não estica o filho sozinho).
                       // Pedido do Audrei: o número animado (+68) sai de baixo
                       // da grade e entra DENTRO do cartão 4 — é aqui, em
                       // "pronto em minutos", que faz sentido reforçar que
                       // outras pessoas já terminaram rápido. `ref={statRef}`
                       // só no cartão 4: é ele quem dispara a contagem ao
                       // entrar na tela, os outros três não mexem nisso.
                       ref={i === 3 ? statRef : undefined}
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
                    <div ref={(el) => { badgeRefs.current[i] = el }}
                         className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                         style={{ background: STEP_GRADIENTS[i], boxShadow: "0 4px 20px rgba(240,25,107,0.3)" }}>
                      <span className="text-white font-bold text-xl" style={bodyFont}>{s.n}</span>
                    </div>
                    <h3 className="font-semibold text-white text-base mb-2" style={bodyFont}>{s.label}</h3>
                    {i === 3 ? (
                      // NÚMERO FICTÍCIO — decisão explícita do Audrei (ver
                      // comentário em `statValue` lá em cima). Não confundir
                      // com a vitrine de preços/produtos, onde todo número
                      // que o cliente vê vem do banco: aqui é o oposto,
                      // registrado por escrito porque é a exceção.
                      <p className="text-sm text-white/60 leading-relaxed" style={bodyFont}>
                        <span className="font-extrabold tabular-nums"
                              style={{ background: "linear-gradient(90deg,#f0196b,#d946ef)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                          +{Math.floor(statValue).toLocaleString("pt-BR")}
                        </span>{" "}
                        histórias já viraram música — sem complicação.
                      </p>
                    ) : (
                      <p className="text-sm text-white/60 leading-relaxed" style={bodyFont}>{s.desc}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════════
          EMOTIONAL / VIDEO
      ═══════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 py-14 lg:py-28 grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">

        <div>
          {/* Mesma lógica dos outros títulos (pedido do Audrei): selo "A
              experiência" removido, fonte passa da serifada (Cormorant)
              pra DM Sans extrabold em caixa alta, trecho de destaque no
              degradê rosa→roxo em vez do rosa chapado do <em>. */}
          <h2 className="font-extrabold uppercase leading-[0.98] tracking-tight mb-8" style={bodyFont}>
            <span className="block text-white/90" style={{ fontSize: "clamp(1.7rem, 3vw, 2.6rem)" }}>
              Muito mais do que uma música,
            </span>
            <span className="block" style={{ fontSize: "clamp(1.7rem, 3vw, 2.6rem)", background: "linear-gradient(90deg,#f0196b,#d946ef)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              é uma experiência completa.
            </span>
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
      <BarraHome />
    </div>
  )
}

