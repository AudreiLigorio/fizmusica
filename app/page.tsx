"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const [playing, setPlaying] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const router = useRouter()

  return (
    <div className="min-h-screen bg-black text-white font-sans">

      {/* HEADER */}

      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/70 border-b border-white/10">

        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">

          {/* LOGO */}

          <div className="flex items-center gap-5">

            <img
              src="/logo_fizmusica.png"
              alt="FizMusica"
              className="h-24 w-auto drop-shadow-[0_0_15px_rgba(236,72,153,0.45)]"
            />

            <img
              src="/som.png"
              alt="Wave"
              className="h-5 md:h-6 w-auto opacity-80 drop-shadow-[0_0_12px_rgba(236,72,153,0.25)]"
            />

          </div>

          {/* CTA */}

          <button
            onClick={() => router.push("/criar")}
            className="bg-pink-500 hover:bg-pink-600 transition-all px-7 py-3 rounded-2xl font-semibold shadow-lg shadow-pink-500/20"
          >
            Criar música
          </button>

        </div>

      </header>

      {/* HERO */}

      <section className="relative overflow-hidden border-b border-white/10 pt-36">

        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 via-purple-500/10 to-black" />

        <div className="relative max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center">

          {/* TEXTO */}

          <div>

            <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm mb-6 backdrop-blur-sm">
              🎵 Música personalizada com IA
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-6">
              Transforme sua história em uma música inesquecível.
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

            <div className="bg-white/10 border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">

  <div className="bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl p-6 mb-8">

    <div className="text-2xl font-bold mb-2">
      Sua História. Sua Música ❤️
    </div>

    <div className="opacity-80 text-lg">
      Ouça alguns exemplos emocionantes
    </div>

  </div>

  <div className="space-y-5">

    {/* EXEMPLO 1 */}

    <div className="bg-black/30 border border-white/10 rounded-2xl p-5 hover:border-pink-500/40 transition-all">

      <div className="flex items-center justify-between gap-4">

        <div>

          <div className="text-xl font-semibold mb-1">
            💖 Homenagem Dia dos Namorados
          </div>

          <div className="text-gray-400 text-sm">
            Sertanejo romântico • 3:12
          </div>

        </div>

        <button
          onClick={() => {
            if (!audioRef.current) return

            audioRef.current.src = "/exemplo_namorados.mpeg"

            if (playing) {
              audioRef.current.pause()
              setPlaying(false)
            } else {
              audioRef.current.play()
              setPlaying(true)
            }
          }}
          className="w-14 h-14 rounded-full bg-pink-500 text-2xl hover:scale-110 transition-all flex items-center justify-center shadow-lg shadow-pink-500/20"
        >
          {playing ? "⏸" : "▶"}
        </button>

      </div>

    </div>

    {/* EXEMPLO 2 */}

    <div className="bg-black/30 border border-white/10 rounded-2xl p-5 hover:border-pink-500/40 transition-all">

      <div className="flex items-center justify-between gap-4">

        <div>

          <div className="text-xl font-semibold mb-1">
            💍 Aniversário de Casamento
          </div>

          <div className="text-gray-400 text-sm">
            Pop romântico • 2:58
          </div>

        </div>

        <button
          onClick={() => {
            if (!audioRef.current) return

            audioRef.current.src = "/exemplo_casamento.mpeg"

            if (playing) {
              audioRef.current.pause()
              setPlaying(false)
            } else {
              audioRef.current.play()
              setPlaying(true)
            }
          }}
          className="w-14 h-14 rounded-full bg-pink-500 text-2xl hover:scale-110 transition-all flex items-center justify-center shadow-lg shadow-pink-500/20"
        >
          {playing ? "⏸" : "▶"}
        </button>

      </div>

    </div>

    {/* EXEMPLO 3 */}

    <div className="bg-black/30 border border-white/10 rounded-2xl p-5 hover:border-pink-500/40 transition-all">

      <div className="flex items-center justify-between gap-4">

        <div>

          <div className="text-xl font-semibold mb-1">
            👶 Surpresa: Você Vai Ser Papai
          </div>

          <div className="text-gray-400 text-sm">
            Piano emocionante • 3:34
          </div>

        </div>

        <button
          onClick={() => {
            if (!audioRef.current) return

            audioRef.current.src = "/exemplo_gravidez.mpeg"

            if (playing) {
              audioRef.current.pause()
              setPlaying(false)
            } else {
              audioRef.current.play()
              setPlaying(true)
            }
          }}
          className="w-14 h-14 rounded-full bg-pink-500 text-2xl hover:scale-110 transition-all flex items-center justify-center shadow-lg shadow-pink-500/20"
        >
          {playing ? "⏸" : "▶"}
        </button>

      </div>

    </div>

  </div>

  <audio ref={audioRef} />

</div>


          </div>

        </div>

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
              🎶 Cada detalhe da história transformado em música.
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

<section className="max-w-7xl mx-auto px-6 py-28">

  <div className="text-center mb-20">

    <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 px-5 py-2 rounded-full text-pink-300 mb-6">
      🎶 Feito para momentos reais
    </div>

    <h2 className="text-5xl font-bold mb-6 leading-tight">
      Criamos músicas para todos os momentos especiais da vida.
    </h2>

    <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
      Cada homenagem é personalizada de acordo com a história, emoção e momento vivido.
    </p>

  </div>

  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">

    {/* AMOR */}

    <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 hover:border-pink-500/30 transition-all">

      <div className="text-5xl mb-6">
        ❤️
      </div>

      <h3 className="text-3xl font-bold mb-5">
        Amor & Relacionamentos
      </h3>

      <div className="space-y-3 text-gray-300 text-lg">

        <div>💍 Pedido de casamento</div>
        <div>💖 Dia dos Namorados</div>
        <div>🥹 Reconciliação</div>
        <div>👰 Casamento</div>
        <div>🎂 Aniversário namoro</div>
        <div>💌 Declaração de amor</div>

      </div>

    </div>

    {/* FAMÍLIA */}

    <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 hover:border-pink-500/30 transition-all">

      <div className="text-5xl mb-6">
        👨‍👩‍👧
      </div>

      <h3 className="text-3xl font-bold mb-5">
        Família
      </h3>

      <div className="space-y-3 text-gray-300 text-lg">

        <div>👩 Música para mãe</div>
        <div>👨 Música para pai</div>
        <div>👵 Homenagem para avó</div>
        <div>👴 Homenagem para avô</div>
        <div>💖 Gratidão familiar</div>
        <div>🏡 Memórias da família</div>

      </div>

    </div>

    {/* BEBÊ */}

    <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 hover:border-pink-500/30 transition-all">

      <div className="text-5xl mb-6">
        👶
      </div>

      <h3 className="text-3xl font-bold mb-5">
        Gravidez & Bebê
      </h3>

      <div className="space-y-3 text-gray-300 text-lg">

        <div>🤰 Descoberta gravidez</div>
        <div>👶 Chá revelação</div>
        <div>🍼 Nascimento bebê</div>
        <div>👨 Você vai ser papai</div>
        <div>👵 Você vai ser vovó</div>
        <div>🌙 Canção de ninar</div>

      </div>

    </div>

    {/* CONQUISTAS */}

    <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 hover:border-pink-500/30 transition-all">

      <div className="text-5xl mb-6">
        🎓
      </div>

      <h3 className="text-3xl font-bold mb-5">
        Conquistas
      </h3>

      <div className="space-y-3 text-gray-300 text-lg">

        <div>🎓 Formatura</div>
        <div>🏆 Aprovação</div>
        <div>💼 Novo trabalho</div>
        <div>🚀 Conquista profissional</div>
        <div>💪 Superação pessoal</div>
        <div>🌟 Realização de sonho</div>

      </div>

    </div>

    {/* DATAS */}

    <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 hover:border-pink-500/30 transition-all">

      <div className="text-5xl mb-6">
        🎂
      </div>

      <h3 className="text-3xl font-bold mb-5">
        Datas Especiais
      </h3>

      <div className="space-y-3 text-gray-300 text-lg">

        <div>🎂 Aniversário</div>
        <div>🎄 Natal</div>
        <div>🥂 Ano novo</div>
        <div>🎉 Festa surpresa</div>
        <div>💝 Presente especial</div>
        <div>🎊 Bodas</div>

      </div>

    </div>

    {/* HOMENAGENS */}

    <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 hover:border-pink-500/30 transition-all">

      <div className="text-5xl mb-6">
        🕊️
      </div>

      <h3 className="text-3xl font-bold mb-5">
        Homenagens & Saudade
      </h3>

      <div className="space-y-3 text-gray-300 text-lg">

        <div>🕊️ Homenagem póstuma</div>
        <div>💖 Saudade especial</div>
        <div>🙏 Gratidão eterna</div>
        <div>🌹 Música memorial</div>
        <div>✨ Recordações especiais</div>
        <div>💫 Tributo emocional</div>

      </div>

    </div>

  </div>

</section>
      {/* CTA FINAL */}

      <section className="max-w-5xl mx-auto px-6 py-28 text-center">

        <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/20 rounded-[40px] p-14">

          <div className="text-6xl mb-8">
            🎶
          </div>

          <h2 className="text-5xl font-bold mb-6 leading-tight">
            Sua história merece virar música.
          </h2>

          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Transforme momentos especiais em uma música emocionante e inesquecível.
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

      <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 px-5 py-2 rounded-full text-pink-300 mb-6">
        ❤️ Muito além de uma música
      </div>

      <h2 className="text-5xl font-bold mb-6">
        Por que escolher a Fiz Música?
      </h2>

      <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
        Nós não criamos apenas músicas. Criamos experiências emocionais inesquecíveis capazes de marcar momentos para sempre.
      </p>

    </div>

    <div className="grid lg:grid-cols-3 gap-8">

      {/* CARD 1 */}

      <div className="bg-white/5 border border-white/10 rounded-[32px] p-10 hover:border-pink-500/30 transition-all">

        <div className="w-20 h-20 rounded-3xl bg-pink-500/20 flex items-center justify-center text-4xl mb-8">
          💖
        </div>

        <h3 className="text-3xl font-bold mb-5">
          Experiência emocional real
        </h3>

        <p className="text-gray-300 text-lg leading-relaxed">
          Cada música é construída a partir da sua história, sentimentos, momentos especiais e detalhes únicos. Nosso foco é emocionar de verdade.
        </p>

      </div>

      {/* CARD 2 */}

      <div className="bg-white/5 border border-white/10 rounded-[32px] p-10 hover:border-pink-500/30 transition-all">

        <div className="w-20 h-20 rounded-3xl bg-pink-500/20 flex items-center justify-center text-4xl mb-8">
          🎵
        </div>

        <h3 className="text-3xl font-bold mb-5">
          Música personalizada de verdade
        </h3>

        <p className="text-gray-300 text-lg leading-relaxed">
          Nada genérico. Cada letra é criada exclusivamente para a sua história, com o estilo musical e emoção que fazem sentido para o momento.
        </p>

      </div>

      {/* CARD 3 */}

      <div className="bg-white/5 border border-white/10 rounded-[32px] p-10 hover:border-pink-500/30 transition-all">

        <div className="w-20 h-20 rounded-3xl bg-pink-500/20 flex items-center justify-center text-4xl mb-8">
          ✨
        </div>

        <h3 className="text-3xl font-bold mb-5">
          Um presente inesquecível
        </h3>

        <p className="text-gray-300 text-lg leading-relaxed">
          Mais do que um presente, você entrega uma lembrança eterna. Uma música criada especialmente para emocionar alguém importante.
        </p>

      </div>

    </div>

    {/* DESTAQUES */}

    <div className="mt-20 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-[40px] p-12">

      <div className="grid lg:grid-cols-2 gap-12 items-center">

        <div>

          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm mb-6">
            🚀 Nosso diferencial
          </div>

          <h3 className="text-4xl font-bold mb-6 leading-tight">
            Acreditamos que cada história merece sua própria trilha sonora.
          </h3>

          <p className="text-xl text-gray-300 leading-relaxed">
            Enquanto outras plataformas focam apenas em gerar músicas automaticamente, nós focamos na experiência emocional completa do cliente.
          </p>

        </div>

        <div className="space-y-6">

          {[
            "❤️ Experiência emocional guiada",
            "🎶 Músicas realmente personalizadas",
            "⚡ Atendimento humanizado via WhatsApp",
            "🎤 Diversos estilos musicais",
            "🔒 Processo simples e seguro",
            "🎁 Ideal para presentes emocionantes",
          ].map((item) => (

            <div
              key={item}
              className="bg-black/30 border border-white/10 rounded-2xl px-6 py-5 text-lg"
            >
              {item}
            </div>

          ))}

        </div>

      </div>

    </div>

  </div>

</section>



      {/* FOOTER */}

      <footer className="border-t border-white/10 py-16 text-center text-gray-500">

        <img
          src="/logo_fizmusica.png"
          alt="FizMusica"
          className="h-20 mx-auto mb-6 opacity-90 drop-shadow-[0_0_25px_rgba(236,72,153,0.35)]"
        />

        <p className="text-lg text-gray-300 mb-2">
          Sua história. Sua música.
        </p>

        <p className="text-sm text-gray-500">
          © 2026 FizMusica
        </p>

      </footer>

    </div>
  )
}