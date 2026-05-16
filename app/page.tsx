"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"

export default function MusicLoveLanding() {
  const [loading, setLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
const [playing, setPlaying] = useState(false)
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

      <div>
       <img
            src="/som.png"
            alt="Wave"
            className="
              h-5
              md:h-6
              w-auto
              opacity-80
              drop-shadow-[0_0_12px_rgba(236,72,153,0.25)]
            "
          />

       
      </div>

    </div>

    {/* CTA */}
    <button
      onClick={() => {
        document
          .getElementById("formulario")
          ?.scrollIntoView({ behavior: "smooth" })
      }}
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
              <button className="bg-pink-500 hover:bg-pink-600 px-8 py-4 rounded-2xl text-lg font-semibold transition-all shadow-2xl shadow-pink-500/20">
                Criar minha música
              </button>

              <button className="border border-white/20 hover:bg-white/10 px-8 py-4 rounded-2xl text-lg transition-all">
                Ver exemplo
              </button>
            </div>

            <div className="flex gap-8 text-sm text-gray-400">
              <div>❤️ Presente único</div>
              <div>⚡ Entrega via WhatsApp</div>
              <div>🔒 Pagamento seguro</div>
            </div>
          </div>

          <div className="relative">
            <div className="bg-white/10 border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">

              <div className="bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl p-6 mb-6">
                <div className="text-sm opacity-80 mb-2">
                  Exemplo
                </div>

                <div className="text-2xl font-bold mb-1">
                  Sua História. Sua Música ❤️
                </div>

                <div className="opacity-80">
                  Música personalizada
                </div>
              </div>

              <div className="space-y-4">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="w-2/3 h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full" />
                </div>

                <div className="flex justify-between text-sm text-gray-400">
                  <span>1:24</span>
                  <span>3:52</span>
                </div>

                <div className="flex justify-center gap-4 pt-4">

  <button className="w-12 h-12 rounded-full bg-white/10">
    ⏮
  </button>

  <button
    onClick={() => {
      if (!audioRef.current) return

      if (playing) {
        audioRef.current.pause()
        setPlaying(false)
      } else {
        audioRef.current.play()
        setPlaying(true)
      }
    }}
    className="w-16 h-16 rounded-full bg-pink-500 text-2xl hover:scale-110 transition-all"
  >
    {playing ? "⏸" : "▶"}
  </button>

  <button className="w-12 h-12 rounded-full bg-white/10">
    ⏭
  </button>

  <audio ref={audioRef} src="/musica_cliente.mpeg" />

</div>
              </div>

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
              💖 Imagine a reação da pessoa ao ouvir uma música feita especialmente para ele/a.
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
              ["3", "Receba WhatsApp"],
              ["4", "Realiza o Pagamento"],
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

      {/* FORM */}
      <section className="max-w-5xl mx-auto px-6 py-24">

        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-6">
            Crie sua música agora
          </h2>

          <p className="text-xl text-gray-400">
            Cada história merece sua própria trilha sonora.
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault()

            setLoading(true)

            const formData = new FormData(e.currentTarget)

            const response = await fetch(
  "/api/send",
              {
                method: "POST",
                body: JSON.stringify({
  nome: formData.get("nome"),
  email: formData.get("email"),
}),
                headers: {
  "Content-Type": "application/json",
},
              }
            )

            if (response.ok) {
              const params = new URLSearchParams({
  nome: formData.get("nome") as string,
  email: formData.get("email") as string,
  whatsapp: formData.get("whatsapp") as string,
  cidade: formData.get("cidade") as string,
  historia: formData.get("historia") as string,
  homenageado: formData.get("homenageado") as string,
  data_especial: formData.get("data_especial") as string,
  estilo: formData.get("estilo_musical") as string,
  artista: formData.get("artista") as string,
})

router.push(`/sucesso?${params.toString()}`)
            } else {
              alert("Erro ao enviar formulário.")
            }

            setLoading(false)
          }}
          className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-[32px] p-8 lg:p-12 shadow-2xl"
        >

          <div className="grid md:grid-cols-2 gap-6 mb-8">

            <input
              name="nome"
              placeholder="Seu nome"
              className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-pink-500"
            />

            <input
              type="email"
              name="email"
              placeholder="Seu e-mail"
              className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-pink-500"
            />

            <input
              name="whatsapp"
              placeholder="WhatsApp"
              className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-pink-500"
            />

            <input
              name="cidade"
              placeholder="Cidade"
              className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-pink-500"
            />

          </div>

          <div className="bg-pink-500/10 border border-pink-500/20 rounded-2xl p-4 mb-8 text-pink-200">
            ⚠ Informe corretamente seu WhatsApp. Sua música será enviada por lá.
          </div>

          <div className="mb-10">

            <h3 className="text-3xl font-bold mb-4">
              Agora conte sua história 💖
            </h3>

            <p className="text-gray-400 mb-6 text-lg">
              Quanto mais detalhes você compartilhar, mais emocionante e personalizada sua música poderá ficar.
            </p>

            <textarea
              name="historia"
              rows={12}
              placeholder="Conte como vocês se conheceram, momentos marcantes, viagens, dificuldades superadas, frases especiais, apelidos carinhosos, músicas importantes, histórias engraçadas, pedidos, reconciliações ou qualquer detalhe que torne essa música única."
              className="w-full bg-black/40 border border-white/10 rounded-3xl p-8 text-lg outline-none focus:border-pink-500 resize-none"
            />

          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">

            <input
              name="homenageado"
              placeholder="Nome da pessoa homenageada"
              className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-pink-500"
            />

            <input
              name="data_especial"
              placeholder="Data especial"
              className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-pink-500"
            />

          </div>

          <div className="mb-10 bg-white/5 border border-white/10 rounded-3xl p-6">

            <h3 className="text-2xl font-bold mb-4">
              Deseja incluir o nome da pessoa na música? 🎤
            </h3>

            <div className="flex flex-wrap gap-6">

              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="incluir_nome"
                  value="Sim"
                />

                <span>Sim ❤️</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="incluir_nome"
                  value="Não"
                />

                <span>Não</span>
              </label>

            </div>

          </div>

          <div className="mb-10">

            <h3 className="text-2xl font-bold mb-6">
              Escolha o estilo musical 🎵
            </h3>

            <select
              name="estilo_musical"
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-pink-500"
            >
              <option>Sertanejo</option>
              <option>Pagode</option>
              <option>Pop</option>
              <option>Rock</option>
              <option>MPB</option>
              <option>Forró</option>
              <option>Rap</option>
              <option>Hip-Hop</option>
              <option>Funk</option>
              <option>Country</option>
              <option>Gospel</option>
              <option>Internacional</option>
            </select>

          </div>

          <div className="mb-10">

            <input
              name="artista"
              placeholder="Qual artista você gostaria como inspiração?"
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-pink-500"
            />

          </div>

          <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/20 rounded-3xl p-8 mb-10 text-center">

            <div className="text-gray-300 mb-2">
              Música personalizada premium
            </div>

            <div className="text-6xl font-bold mb-4">
              R$ 120
            </div>

            <div className="text-gray-300 text-lg">
              Transforme sua história em uma música única e inesquecível.
            </div>

          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pink-500 hover:bg-pink-600 transition-all py-6 rounded-2xl text-2xl font-bold shadow-2xl shadow-pink-500/20"
          >
            {loading ? "Enviando..." : "Finalizar pedido ❤️"}
          </button>

        </form>

      </section>

      <footer className="border-t border-white/10 py-16 text-center text-gray-500">

  <img
    src="/logo_fizmusica.png"
    alt="FizMusica"
    className="h-20 mx-auto mb-6 opacity-90 drop-shadow-[0_0_25px_rgba(236,72,153,0.35)]"
  />

  <p className="text-lg text-gray-300 mb-2">
    Sua história. Sua Música.
  </p>

  <p className="text-sm text-gray-500">
    © 2026 FizMusica
  </p>

</footer>

    </div>
  )
}