"use client"

import { useRouter } from "next/navigation"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"

const VALORES = [
  {
    emoji: "🎯",
    title: "Obsessão pelo detalhe",
    desc: "A frase que o cliente esqueceu de mencionar, o apelido que só a família usa, o jeito que ela ri — tudo isso vira letra. Não existe música genérica aqui.",
  },
  {
    emoji: "💜",
    title: "Emoção é o produto",
    desc: "A música é o meio. O que a gente entrega de verdade é aquele nó na garganta, aquela lágrima que escorreu sem avisar. Isso é o que nos move.",
  },
  {
    emoji: "🚀",
    title: "Tecnologia a serviço do sentimento",
    desc: "Usamos o que há de melhor em IA e produção musical para escalar sem perder a alma. Cada música soa feita à mão — porque foi.",
  },
  {
    emoji: "🤝",
    title: "Cliente no centro (de verdade)",
    desc: "Não é slogan. É o nosso WhatsApp aberto, a revisão sem custo extra, o prazo que a gente cumpre mesmo que precise virar a noite.",
  },
]

const NUMEROS = [
  { numero: "+10.000", label: "músicas entregues" },
  { numero: "+8.000",  label: "pessoas emocionadas" },
  { numero: "4.9★",   label: "satisfação média" },
  { numero: "100%",   label: "personalizado" },
]

const TIMELINE = [
  {
    ano: "O começo",
    titulo: "Uma ideia num estúdio",
    desc: "Tudo começou quando o fundador quis presentear alguém especial com algo que dinheiro não compra — uma música feita só para aquela pessoa. Não encontrou nada parecido no mercado. Então resolveu criar.",
  },
  {
    ano: "A virada",
    titulo: "O primeiro choro de cliente",
    desc: "A segunda música entregue fez a cliente chorar ao ouvir. Naquele momento ficou claro: isso não era só um serviço. Era uma ponte entre sentimentos e palavras que as pessoas não sabiam como expressar.",
  },
  {
    ano: "O crescimento",
    titulo: "Times, ferramentas e escala",
    desc: "Músicos, produtores e tecnologia entraram no jogo. A plataforma foi construída do zero para garantir que cada cliente vivesse a mesma experiência do primeiro — pessoal, rápida e inesquecível.",
  },
  {
    ano: "Hoje",
    titulo: "Milhares de histórias compostas",
    desc: "São mais de 10 mil músicas entregues, dezenas de estilos, pessoas de todo o Brasil. E a cada pedido novo, a mesma pergunta que orienta tudo: como a gente faz isso ser ainda mais especial?",
  },
]

export default function QuemSomosPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen text-white font-sans overflow-x-hidden" style={{ background: "#07060d" }}>
      <Header />

      {/* Fundo ambience */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-[-10%] w-[60vw] h-[60vw] rounded-full blur-[140px] opacity-20"
             style={{ background: "radial-gradient(circle, #f0196b 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[140px] opacity-15"
             style={{ background: "radial-gradient(circle, #d946ef 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-32 pb-20">

        {/* ── HERO ── */}
        <div className="mb-20">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-6" style={{ color: "#f0196b" }}>
            Quem somos
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light leading-[1.05] mb-8" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
            Somos a startup que<br />
            <em style={{ color: "#f0196b" }}>transforma histórias</em><br />
            em músicas.
          </h1>
          <p className="text-white/55 text-lg leading-relaxed max-w-2xl">
            Não somos uma gravadora. Não somos um estúdio tradicional. Somos uma plataforma obcecada em fazer as pessoas sentirem — de verdade — que existe uma música no mundo feita exclusivamente para elas.
          </p>
        </div>

        {/* ── NÚMEROS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-20">
          {NUMEROS.map(({ numero, label }) => (
            <div key={label} className="rounded-2xl p-5 text-center"
                 style={{ background: "rgba(240,25,107,0.06)", border: "1px solid rgba(240,25,107,0.15)" }}>
              <p className="text-3xl font-bold mb-1 bg-gradient-to-r from-pink-400 to-fuchsia-400 bg-clip-text text-transparent">
                {numero}
              </p>
              <p className="text-xs text-white/40">{label}</p>
            </div>
          ))}
        </div>

        {/* ── MANIFESTO ── */}
        <div className="mb-20 rounded-3xl p-8 lg:p-12"
             style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-6 text-white/30">Nosso manifesto</p>
          <div className="space-y-5 text-white/70 leading-relaxed text-lg">
            <p>
              A gente acredita que <strong className="text-white">todo mundo tem uma história que merece virar música.</strong> Não só os famosos. Não só quem toca instrumento. Qualquer pessoa que ama alguém tem material suficiente para uma obra-prima.
            </p>
            <p>
              O problema é que transformar sentimento em arte não é simples. Você pode saber exatamente o que sente e não saber como dizer. A gente existe pra resolver isso.
            </p>
            <p>
              <strong className="text-white">Pegamos a sua história, os seus detalhes, o seu jeito —</strong> e devolvemos uma música que soa como se sempre tivesse existido, esperando só para ser ouvida pela pessoa certa.
            </p>
          </div>
        </div>

        {/* ── COMO NASCEMOS ── */}
        <div className="mb-20">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-10 text-white/30">Como chegamos até aqui</p>
          <div className="space-y-0">
            {TIMELINE.map(({ ano, titulo, desc }, i) => (
              <div key={i} className="flex gap-6 pb-10">
                {/* Linha vertical */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                       style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }} />
                  {i < TIMELINE.length - 1 && (
                    <div className="w-px flex-1 mt-2" style={{ background: "rgba(255,255,255,0.08)" }} />
                  )}
                </div>
                {/* Conteúdo */}
                <div className="pb-2">
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#f0196b" }}>{ano}</p>
                  <h3 className="text-lg font-semibold mb-2 text-white">{titulo}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── VALORES ── */}
        <div className="mb-20">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-10 text-white/30">O que nos move</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {VALORES.map(({ emoji, title, desc }) => (
              <div key={title} className="rounded-2xl p-6 transition-all hover:border-pink-500/20"
                   style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="text-3xl mb-4 block">{emoji}</span>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── QUEM FAZ ── */}
        <div className="mb-20 rounded-3xl p-8 lg:p-12"
             style={{ background: "rgba(240,25,107,0.05)", border: "1px solid rgba(240,25,107,0.12)" }}>
          <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-6 text-white/30">O time por trás disso</p>
          <p className="text-white/70 leading-relaxed">
            A FizMusica foi fundada por alguém que acredita que <strong className="text-white">a tecnologia mais poderosa é aquela que faz você sentir algo.</strong> Desde o início, a missão foi clara: democratizar o acesso a músicas personalizadas de verdade.
          </p>
        </div>

        {/* ── CONTATO ── */}
        <div className="mb-20">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-6 text-white/30">Fala com a gente</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="https://wa.me/5511996645678" target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-3 px-6 py-4 rounded-2xl font-medium text-white transition-all hover:brightness-110"
               style={{ background: "#22c55e" }}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              (11) 99664-5678
            </a>
            <a href="mailto:contato@fizmusica.com.br"
               className="flex items-center gap-3 px-6 py-4 rounded-2xl font-medium text-white/70 hover:text-white transition-colors"
               style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              contato@fizmusica.com.br
            </a>
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="text-center rounded-3xl p-10"
             style={{ background: "linear-gradient(135deg, rgba(240,25,107,0.12), rgba(168,85,247,0.10))", border: "1px solid rgba(240,25,107,0.2)" }}>
          <h2 className="text-2xl font-bold mb-3">Pronto para criar a sua?</h2>
          <p className="text-white/50 text-sm mb-6">Leva menos de 5 minutos. O resultado dura a vida toda.</p>
          <button
            onClick={() => router.push("/criar")}
            className="px-8 py-4 rounded-2xl font-bold text-white transition-all hover:brightness-110 active:scale-[0.97]"
            style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 8px 32px rgba(240,25,107,0.4)" }}
          >
            Criar minha música ❤️
          </button>
        </div>

      </div>

      <Footer />
    </div>
  )
}
