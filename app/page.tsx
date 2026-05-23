"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import FizMusicaCarousel from "./components/FizMusicaCarousel";
import Header from "./components/Header"
import Footer from "./components/Footer"



export default function Home() {
  const [playing, setPlaying] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const router = useRouter()
  const [currentAudio, setCurrentAudio] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-black text-white font-sans">

      <Header />

      {/* HERO */}

      <section className="relative overflow-hidden border-b border-white/10 pt-36">

        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 via-purple-500/10 to-black" />

        <div className="relative max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center">

          {/* TEXTO */}

          <div>

            <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-6">
              Existem histórias que merecem ser cantadas.
            </h1>

            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Crie uma música personalizada e emocione quem você ama com um presente único.
            </p>

            <div className="flex flex-wrap gap-4 mb-8">

              <button
                onClick={() => router.push("/criar")}
                className="bg-pink-500 hover:bg-pink-600 px-8 py-4 rounded-2xl text-lg font-semibold transition-all shadow-2xl shadow-pink-500/20"
              >
                Criar minha música
              </button>



            </div>

            <div className="flex gap-8 text-sm text-gray-400">
              <div>❤️ Presente único</div>
              <div>⚡ Entrega via WhatsApp</div>
              <div>🔒 Pagamento seguro</div>
            </div>

          </div>

          {/* PLAYER */}
          <div className="relative">

            <div className="bg-white/10 border border-white/10 backdrop-blur-xl rounded-3xl p-4 md:p-8 shadow-2xl">

              <div className="bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl p-5 md:p-6 mb-6 md:mb-8">

                <div className="text-xl md:text-2xl font-bold mb-2">
                  Sua História. Sua Música ❤️
                </div>

                <div className="opacity-80 text-sm md:text-lg">
                  Ouça alguns exemplos emocionantes
                </div>

              </div>

              <div className="space-y-4">

                {/* EXEMPLO 1 */}
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 md:p-5 hover:border-pink-500/40 transition-all">

                  <div className="flex items-center justify-between gap-3">

                    <div className="flex-1 min-w-0">

                      <div className="text-base md:text-xl font-semibold mb-1 leading-tight">
                        💖 Homenagem Dia dos Namorados
                      </div>

                      <div className="text-gray-400 text-xs md:text-sm">
                        Para: Maria Eduarda | Sertanejo romântico • 3:12
                      </div>

                    </div>

                    <button
                      onClick={() => {
                        if (!audioRef.current) return

                        if (
                          currentAudio === "/namoro_2anos.mp3" &&
                          playing
                        ) {
                          audioRef.current.pause()
                          setPlaying(false)
                          return
                        }

                        audioRef.current.src = "/namoro_2anos.mp3"
                        audioRef.current.play()

                        setCurrentAudio("/namoro_2anos.mp3")
                        setPlaying(true)
                      }}
                      className="w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-full bg-pink-500 text-xl md:text-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-pink-500/20"
                    >
                      {playing && currentAudio === "/namoro_2anos.mp3"
                        ? "⏸"
                        : "▶"}
                    </button>

                  </div>

                </div>

                {/* EXEMPLO 2 */}
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 md:p-5 hover:border-pink-500/40 transition-all">

                  <div className="flex items-center justify-between gap-3">

                    <div className="flex-1 min-w-0">

                      <div className="text-base md:text-xl font-semibold mb-1 leading-tight">
                        💍 Aniversário de Casamento
                      </div>

                      <div className="text-gray-400 text-xs md:text-sm">
                        Para: Patricia "Mô" | Pagode romântico • 2:58
                      </div>

                    </div>

                    <button
                      onClick={() => {
                        if (!audioRef.current) return

                        if (
                          currentAudio === "/aniversario_casamento.mp3" &&
                          playing
                        ) {
                          audioRef.current.pause()
                          setPlaying(false)
                          return
                        }

                        audioRef.current.src = "/aniversario_casamento.mp3"
                        audioRef.current.play()

                        setCurrentAudio("/aniversario_casamento.mp3")
                        setPlaying(true)
                      }}
                      className="w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-full bg-pink-500 text-xl md:text-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-pink-500/20"
                    >
                      {playing && currentAudio === "/aniversario_casamento.mp3"
                        ? "⏸"
                        : "▶"}
                    </button>

                  </div>

                </div>

                {/* EXEMPLO 3 */}
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 md:p-5 hover:border-pink-500/40 transition-all">

                  <div className="flex items-center justify-between gap-3">

                    <div className="flex-1 min-w-0">

                      <div className="text-base md:text-xl font-semibold mb-1 leading-tight">
                        👶 Chá Revelação - Revela só no último trecho da música. (Incrível)
                      </div>

                      <div className="text-gray-400 text-xs md:text-sm">
                        É Menina | Sertanejo animado • 3:34
                      </div>

                    </div>

                    <button
                      onClick={() => {
                        if (!audioRef.current) return

                        if (
                          currentAudio === "/cha_revelacao_menina.mp3" &&
                          playing
                        ) {
                          audioRef.current.pause()
                          setPlaying(false)
                          return
                        }

                        audioRef.current.src = "/cha_revelacao_menina.mp3"
                        audioRef.current.play()

                        setCurrentAudio("/cha_revelacao.mp3")
                        setPlaying(true)
                      }}
                      className="w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-full bg-pink-500 text-xl md:text-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-pink-500/20"
                    >
                      {playing && currentAudio === "/cha_revelacao_menina.mp3"
                        ? "⏸"
                        : "▶"}
                    </button>

                  </div>

                </div>
                {/* EXEMPLO 4 */}
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 md:p-5 hover:border-pink-500/40 transition-all">

                  <div className="flex items-center justify-between gap-3">

                    <div className="flex-1 min-w-0">

                      <div className="text-base md:text-xl font-semibold mb-1 leading-tight">
                        ✨ Despedida Pet - Amora
                      </div>

                      <div className="text-gray-400 text-xs md:text-sm">
                        Homenagem Amora | Sentimental - MPB • 3:20
                      </div>

                    </div>

                    <button
                      onClick={() => {
                        if (!audioRef.current) return

                        if (
                          currentAudio === "/despedida_pet.mp3" &&
                          playing
                        ) {
                          audioRef.current.pause()
                          setPlaying(false)
                          return
                        }

                        audioRef.current.src = "/despedida_pet.mp3"
                        audioRef.current.play()

                        setCurrentAudio("/despedida_pet.mp3")
                        setPlaying(true)
                      }}
                      className="w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-full bg-pink-500 text-xl md:text-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-pink-500/20"
                    >
                      {playing && currentAudio === "/despedida_pet.mp3"
                        ? "⏸"
                        : "▶"}
                    </button>

                  </div>

                </div>


              </div>

              <audio
                ref={audioRef}
                onEnded={() => {
                  setPlaying(false)
                  setCurrentAudio(null)
                }}
              />

            </div>

          </div>
          {/* player */}

        </div>

      </section>

      {/* CARROSSEL */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <FizMusicaCarousel />
      </section>

      {/* VIDEO */}

      <section className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">

        <div>

          <h2 className="text-4xl font-bold mb-6">
            Veja a emoção de transformar sentimentos em música.
          </h2>

          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            Um presente personalizado capaz de marcar momentos para sempre.
          </p>

          <div className="space-y-6 text-gray-300 text-lg">

            <p>
              💖 Imagine a reação da pessoa ao ouvir uma música feita especialmente para ela.
            </p>

            <p>
              🎁 Mais do que um presente. Uma lembrança para a vida toda.
            </p>

            <p>
              🎶 Nós te entregamos emoção e amor.
            </p>

          </div>

        </div>

        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-white/5 aspect-video flex items-center justify-center">

          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-purple-500/10" />

          <button className="relative w-24 h-24 rounded-full bg-white/20 backdrop-blur-xl text-4xl hover:scale-110 transition-all">
            ▶
          </button>

        </div>

      </section>

      {/* COMO FUNCIONA */}

      <section className="border-y border-white/10 bg-white/5">

        <div className="max-w-7xl mx-auto px-6 py-24">

          <h2 className="text-4xl font-bold text-center mb-16">
            Como funciona
          </h2>

          <div className="grid md:grid-cols-4 gap-8">

            {[
              ["1", "Conte sua história"],
              ["2", "Escolha o estilo musical"],
              ["3", "Receba no WhatsApp"],
              ["4", "Emocione alguém especial"],
            ].map(([n, text]) => (

              <div
                key={n}
                className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center"
              >

                <div className="w-16 h-16 rounded-full bg-pink-500 mx-auto mb-6 flex items-center justify-center text-2xl font-bold">
                  {n}
                </div>

                <h3 className="text-xl font-semibold">
                  {text}
                </h3>

              </div>

            ))}

          </div>

        </div>

      </section>
      {/* TIPOS DE HOMENAGENS */}

   
      {/* CTA FINAL */}

      <section className="max-w-5xl mx-auto px-6 py-28 text-center">

        <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/20 rounded-[40px] p-14">

          <div className="text-6xl mb-8">
            🎶
          </div>

          <h2 className="text-5xl font-bold mb-6 leading-tight">
            Emocione agora quem você ama
          </h2>

          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            É fácil, rápido e personalizado. Será único e inesquecível.
          </p>

          <button
            onClick={() => router.push("/criar")}
            className="bg-pink-500 hover:bg-pink-600 transition-all px-10 py-5 rounded-3xl text-2xl font-bold shadow-2xl shadow-pink-500/20"
          >
            Criar minha música ❤️
          </button>

        </div>

      </section>
      {/* POR QUE ESCOLHER */}

      <section className="border-y border-white/10 bg-white/5">

        <div className="max-w-7xl mx-auto px-6 py-28">

          <div className="text-center mb-20">

            <h2 className="text-5xl font-bold mb-6">
              Por que escolher a Fiz Música?
            </h2>

            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Somos apaixonados por criar experiências emocionais inesquecíveis capazes de marcar momentos para sempre.
            </p>

          </div>

          <div className="grid lg:grid-cols-3 gap-8">

            {/* CARD 1 */}

            <div className="bg-white/5 border border-white/10 rounded-[32px] p-10 hover:border-pink-500/30 transition-all">

              <div className="w-20 h-20 rounded-3xl bg-pink-500/20 flex items-center justify-center text-4xl mb-8">
                💖
              </div>

              <h3 className="text-3xl font-bold mb-5">
                Experiência emocional real tudo feito com muito carinho
              </h3>

              <p className="text-gray-300 text-lg leading-relaxed">
                Cada música é construída a partir da sua história, sentimentos, momentos especiais e detalhes marcantes. Nosso foco é emocionar de verdade.
              </p>

            </div>

            {/* CARD 2 */}

            <div className="bg-white/5 border border-white/10 rounded-[32px] p-10 hover:border-pink-500/30 transition-all">

              <div className="w-20 h-20 rounded-3xl bg-pink-500/20 flex items-center justify-center text-4xl mb-8">
                🎵
              </div>

              <h3 className="text-3xl font-bold mb-5">
                Música personalizada de verdade que toca lá dentro.
              </h3>

              <p className="text-gray-300 text-lg leading-relaxed">
                Nada genérico. Temos um processo de revisão rigoroso. Cada letra é criada exclusivamente para a sua história, com o estilo musical e emoção que fazem sentido para o momento.
              </p>

            </div>

            {/* CARD 3 */}

            <div className="bg-white/5 border border-white/10 rounded-[32px] p-10 hover:border-pink-500/30 transition-all">

              <div className="w-20 h-20 rounded-3xl bg-pink-500/20 flex items-center justify-center text-4xl mb-8">
                ✨
              </div>

              <h3 className="text-3xl font-bold mb-5">
                Maior Plataforma de emoção
              </h3>

              <p className="text-gray-300 text-lg leading-relaxed">
                Temos um time especializado em criar experiências emocionais completas, que vão muito além de apenas entregar uma música. 
              </p>

            </div>

          </div>

          
        </div>

      </section>
      {/* SECTION DIFERENCIAIS PREMIUM */}

<section className="relative overflow-hidden mt-24">

  {/* BG GLOW */}

  <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-pink-500/10 blur-3xl"></div>

  <div className="relative max-w-7xl mx-auto px-6">

    <div className="relative border border-pink-500/20 bg-[#0B0B0F]/80 backdrop-blur-2xl rounded-[42px] overflow-hidden shadow-[0_0_80px_rgba(236,72,153,0.12)]">

      <div className="grid lg:grid-cols-2 gap-0">

        {/* LEFT */}

        <div className="p-8 md:p-14 flex flex-col justify-center">

          {/* TAG */}

          <div className="inline-flex items-center gap-3 bg-white/5 border border-pink-500/20 px-5 py-3 rounded-full text-pink-300 text-sm font-medium mb-8 w-fit backdrop-blur-xl">

            <div className="w-3 h-3 bg-pink-500 rounded-full shadow-[0_0_12px_rgba(236,72,153,0.9)]"></div>

            O que nos torna únicos

          </div>

          {/* TITLE */}

          <h2 className="text-4xl md:text-6xl font-bold leading-[1.05] mb-8 tracking-tight">

            Mais que músicas,
            <span className="bg-gradient-to-r from-pink-400 to-fuchsia-500 bg-clip-text text-transparent">

              {" "}criamos emoções
              que ficam para sempre.

            </span>

          </h2>

          {/* DESCRIPTION */}

          <p className="text-xl text-gray-300 leading-relaxed mb-10 max-w-2xl">

            Enquanto outras plataformas apenas geram músicas,
            nós criamos experiências emocionais completas,
            feitas para tocar o coração de quem recebe.

          </p>

          {/* BENEFITS */}

          <div className="grid sm:grid-cols-2 gap-5">

            <div className="group bg-white/5 border border-white/10 hover:border-pink-500/30 transition-all rounded-3xl p-6 backdrop-blur-xl">

              <div className="w-14 h-14 rounded-2xl bg-pink-500/20 flex items-center justify-center text-2xl mb-5">
                ❤️
              </div>

              <h3 className="text-xl font-semibold mb-3">
                Experiência emocional guiada
              </h3>

              <p className="text-gray-400 leading-relaxed">
                Cada etapa foi criada para transformar sentimentos em músicas inesquecíveis.
              </p>

            </div>

            <div className="group bg-white/5 border border-white/10 hover:border-pink-500/30 transition-all rounded-3xl p-6 backdrop-blur-xl">

              <div className="w-14 h-14 rounded-2xl bg-pink-500/20 flex items-center justify-center text-2xl mb-5">
                🎶
              </div>

              <h3 className="text-xl font-semibold mb-3">
                Letras feitas para sua história
              </h3>

              <p className="text-gray-400 leading-relaxed">
                Cada detalhe da sua história inspira uma música feita especialmente para você.
              </p>

            </div>

            <div className="group bg-white/5 border border-white/10 hover:border-pink-500/30 transition-all rounded-3xl p-6 backdrop-blur-xl">

              <div className="w-14 h-14 rounded-2xl bg-pink-500/20 flex items-center justify-center text-2xl mb-5">
                💬
              </div>

              <h3 className="text-xl font-semibold mb-3">
                Atendimento humanizado
              </h3>

              <p className="text-gray-400 leading-relaxed">
                Nossa equipe acompanha você durante toda a experiência via WhatsApp.
              </p>

            </div>

            <div className="group bg-white/5 border border-white/10 hover:border-pink-500/30 transition-all rounded-3xl p-6 backdrop-blur-xl">

              <div className="w-14 h-14 rounded-2xl bg-pink-500/20 flex items-center justify-center text-2xl mb-5">
                🎁
              </div>

              <h3 className="text-xl font-semibold mb-3">
                Um presente inesquecível
              </h3>

              <p className="text-gray-400 leading-relaxed">
                Mais do que uma música:
                uma lembrança que ficará guardada para sempre.
              </p>

            </div>

          </div>

        </div>

        {/* RIGHT */}

        <div className="relative min-h-[650px] flex items-center justify-center p-10">

          {/* GLOW */}

          <div className="absolute w-[500px] h-[500px] bg-pink-500/20 rounded-full blur-3xl"></div>

          {/* PHOTO */}

          <div className="relative w-full flex justify-center mb-[-40px] z-10">

  <img
    src="/time_fizmusica.png"
    alt="FizMusica"
    className="
      w-full
      max-w-[280px]
      md:max-w-[520px]
      h-auto
      object-contain
      rounded-[32px]
      drop-shadow-[0_0_50px_rgba(236,72,153,0.25)]
    "
  />

</div>

          {/* FLOAT CARD */}

          <div className="absolute bottom-10 left-6 md:left-12 z-20 bg-black/60 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 max-w-sm shadow-2xl">

            <div className="flex items-center gap-4 mb-4">

              <div className="w-14 h-14 rounded-2xl bg-pink-500/20 flex items-center justify-center text-3xl">
                ✨
              </div>

              <div>

                <p className="text-lg font-semibold">
                  Nossa missão é simples:
                </p>

              </div>

            </div>

            <p className="text-2xl font-bold leading-snug">

              Fazer parte das histórias
              mais importantes da sua vida ❤️

            </p>

          </div>

          {/* FLOAT TEXT */}

          <div className="absolute top-14 right-10 text-right hidden md:block">

            <p className="text-3xl text-pink-200 leading-relaxed italic">

              Feito com amor
              <br />
              em cada detalhe ✨

            </p>

          </div>

        </div>

      </div>

      {/* FOOT STATS */}

      <div className="border-t border-white/10 px-8 md:px-14 py-8">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">

          <div className="text-center">

            <div className="text-4xl mb-3">❤️</div>

            <h4 className="text-3xl font-bold mb-1">
              +10.000
            </h4>

            <p className="text-gray-400">
              músicas criadas
            </p>

          </div>

          <div className="text-center">

            <div className="text-4xl mb-3">🥹</div>

            <h4 className="text-3xl font-bold mb-1">
              +8.000
            </h4>

            <p className="text-gray-400">
              clientes emocionados
            </p>

          </div>

          <div className="text-center">

            <div className="text-4xl mb-3">⭐</div>

            <h4 className="text-3xl font-bold mb-1">
              4,9/5
            </h4>

            <p className="text-gray-400">
              satisfação média
            </p>

          </div>

          <div className="text-center">

            <div className="text-4xl mb-3">🛡️</div>

            <h4 className="text-3xl font-bold mb-1">
              Premium
            </h4>

            <p className="text-gray-400">
              experiência assistida
            </p>

          </div>

        </div>

      </div>

    </div>

  </div>

</section>


      <Footer />


    </div>
  )
}