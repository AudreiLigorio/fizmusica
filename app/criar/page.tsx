"use client"

import { useMemo, useState } from "react"
import { formStructure } from "@/app/data/formStructure"

export default function CriarMusicaPage() {

  const [step, setStep] = useState(1)

  const [selectedContext, setSelectedContext] = useState("")
  const [selectedSubcategory, setSelectedSubcategory] = useState("")

  const [answers, setAnswers] = useState<Record<string, string>>({})

  const [musicalStyle, setMusicalStyle] = useState("")
  const [voiceType, setVoiceType] = useState("")
  const [emotion, setEmotion] = useState("")

  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")

  const [error, setError] = useState("")
  const [questionStep, setQuestionStep] = useState(0)

  /* ================================================= */
  /* QUESTIONS */
  /* ================================================= */

  const questions = useMemo(() => {

  if (!selectedContext || !selectedSubcategory) return []

  return (
    formStructure[
      selectedContext as keyof typeof formStructure
    ]?.[
      selectedSubcategory as keyof typeof formStructure[
        keyof typeof formStructure
      ]
    ] || []
  )

}, [selectedContext, selectedSubcategory])

const currentQuestion = questions[questionStep]

  /* ================================================= */
  /* NEXT STEP */
  /* ================================================= */

  const nextStep = () => {

    setError("")

    if (step === 1) {

      if (!selectedContext || !selectedSubcategory) {
        setError("Selecione um contexto e uma subcategoria.")
        return
      }

    }

    if (step === 2) {

  if (
    !answers[currentQuestion] ||
    answers[currentQuestion].trim().length < 3
  ) {
    setError("Responda a pergunta para continuar.")
    return
  }

  if (questionStep < questions.length - 1) {

    setQuestionStep(questionStep + 1)
    return

  } else {

    setStep(3)
    return

  }

}

    if (step === 3) {

      if (!musicalStyle || !voiceType || !emotion) {
        setError("Escolha todas as opções musicais.")
        return
      }

    }

    if (step === 4) {

      if (!nome || !email || !whatsapp) {
        setError("Preencha seus dados.")
        return
      }

    }

    setStep(step + 1)
  }

  const prevStep = () => {
    setError("")
    setStep(step - 1)
  }

  /* ================================================= */
  /* PROGRESS */
  /* ================================================= */

  const totalSteps = 5

const internalQuestionProgress =
  step === 2
    ? (questionStep / questions.length)
    : 0

const progress =
  (
    (
      step - 1 +
      internalQuestionProgress
    ) / totalSteps
  ) * 100

  /* ================================================= */
  /* RESUMO IA */
  /* ================================================= */

  const resumoIA = `
CONTEXTO:
${selectedContext}

SUBCATEGORIA:
${selectedSubcategory}

${questions
  .map(
    (q) => `
${q}
${answers[q] || ""}
`
  )
  .join("\n")}

ESTILO MUSICAL:
${musicalStyle}

TIPO DE VOZ:
${voiceType}

EMOÇÃO:
${emotion}

NOME:
${nome}

E-MAIL:
${email}

WHATSAPP:
${whatsapp}
`

  return (

    <div className="min-h-screen bg-black text-white font-sans">

      {/* HEADER */}

      <div className="max-w-5xl mx-auto px-6 pt-10">

        <div className="flex justify-between text-sm text-gray-400 mb-3">

          <span>
            {step === 2
  ? `Pergunta ${questionStep + 1} de ${questions.length}`
  : `Etapa ${step} de 5`
}
          </span>

          <span>
            {Math.round(progress)}%
          </span>

        </div>

        <div className="h-3 bg-white/10 rounded-full overflow-hidden">

          <div
            className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500"
            style={{
              width: `${progress}%`,
            }}
          />

        </div>

      </div>

      {/* CONTENT */}

      <section className="max-w-5xl mx-auto px-6 py-12">

        <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 lg:p-12 backdrop-blur-xl">

          {/* ================================================= */}
          {/* STEP 1 */}
          {/* ================================================= */}

          {step === 1 && (

            <div>

              <div className="text-center mb-14">

                <h1 className="text-5xl font-bold mb-5">
                  Vamos criar sua música ❤️
                </h1>

                <div className="bg-pink-500/10 border border-pink-500/20 rounded-3xl p-5 max-w-2xl mx-auto text-gray-300 leading-relaxed">

                  ✨ Preencha com carinho cada detalhe da sua história.
                  Quanto mais informações você compartilhar,
                  mais especial ficará sua música ❤️

                </div>

              </div>

              {/* CONTEXTOS */}

              <div className="space-y-6">

                {Object.entries(formStructure).map(
                  ([context, subcategories]) => (

                    <div
                      key={context}
                      className={`border rounded-3xl overflow-hidden transition-all
                      ${
                        selectedContext === context
                          ? "border-pink-500 bg-pink-500/5"
                          : "border-white/10 bg-black/20"
                      }`}
                    >

                      {/* CONTEXTO */}

                      <button
                        onClick={() =>
                          setSelectedContext(
                            selectedContext === context
                              ? ""
                              : context
                          )
                        }
                        className="w-full p-7 flex items-center justify-between text-left"
                      >

                        <div>

                          <h2 className="text-2xl font-bold mb-2">
                            {context}
                          </h2>

                          <p className="text-gray-400">
                            Escolha o momento da sua homenagem
                          </p>

                        </div>

                        <div className="text-2xl text-pink-500">
                          {selectedContext === context ? "−" : "+"}
                        </div>

                      </button>

                      {/* SUBCATEGORIAS */}

                      {selectedContext === context && (

                        <div className="px-7 pb-7 grid md:grid-cols-2 gap-4">

                          {Object.keys(subcategories).map(
                            (subcategory) => (

                              <button
                                key={subcategory}
                                onClick={() =>
                                  setSelectedSubcategory(
                                    subcategory
                                  )
                                }
                                className={`rounded-2xl p-5 border transition-all text-left
                                ${
                                  selectedSubcategory ===
                                  subcategory
                                    ? "border-pink-500 bg-pink-500/10"
                                    : "border-white/10 bg-black/30 hover:border-pink-500"
                                }`}
                              >
                                {subcategory}
                              </button>

                            )
                          )}

                        </div>

                      )}

                    </div>

                  )
                )}

              </div>

            </div>

          )}

          {/* ================================================= */}
          {/* STEP 2 */}
          {/* ================================================= */}

          {step === 2 && (

            <div>

              <h1 className="text-5xl font-bold mb-5">
                Conte sua história ❤️
              </h1>

              <p className="text-xl text-gray-400 mb-12">
                Quanto mais detalhes você compartilhar,
                mais especial ficará sua música.
              </p>

              <div>

  <div className="text-sm text-pink-400 mb-4">
    Pergunta {questionStep + 1} de {questions.length}
  </div>

  <h2 className="text-3xl font-bold mb-6">
    {currentQuestion}
  </h2>

  <textarea
    rows={6}
    value={answers[currentQuestion] || ""}
    onChange={(e) =>
      setAnswers({
        ...answers,
        [currentQuestion]: e.target.value,
      })
    }
    placeholder="Digite sua resposta..."
    className="w-full bg-black/40 border border-white/10 rounded-3xl p-6 text-lg outline-none focus:border-pink-500 resize-none"
  />

</div>

            </div>

          )}

          {/* ================================================= */}
          {/* STEP 3 */}
          {/* ================================================= */}

          {step === 3 && (

            <div>

              <h1 className="text-5xl font-bold mb-5">
                Defina o estilo da música 🎵
              </h1>

              <p className="text-xl text-gray-400 mb-12">
                Escolha o clima da música.
              </p>

              {/* ESTILO */}

              <div className="mb-12">

                <h2 className="text-2xl font-bold mb-6">
                  🎶 Estilo musical
                </h2>

                <div className="grid md:grid-cols-3 gap-4">

                  {[
                    "🎤 Sertanejo",
                    "🎶 Pagode",
                    "💖 Pop",
                    "🪗 Forró",
                    "🎸 Rock",
                    "🎹 MPB",
                    "🙏 Gospel",
                    "🎧 Funk",
                    "🔥 Trap",
                    "🎙️ Rap",
                    "🌎 Internacional",
                  ].map((item) => (

                    <button
                      key={item}
                      onClick={() =>
                        setMusicalStyle(item)
                      }
                      className={`rounded-2xl p-5 border transition-all text-left
                      ${
                        musicalStyle === item
                          ? "border-pink-500 bg-pink-500/10"
                          : "border-white/10 bg-black/30 hover:border-pink-500"
                      }`}
                    >
                      {item}
                    </button>

                  ))}

                </div>

              </div>

              {/* VOZ */}

              <div className="mb-12">

                <h2 className="text-2xl font-bold mb-6">
                  🎤 Tipo de voz
                </h2>

                <div className="grid md:grid-cols-3 gap-4">

                  {[
                    "👨 Masculina",
                    "👩 Feminina",
                    "🎙️ Dueto",
                  ].map((item) => (

                    <button
                      key={item}
                      onClick={() =>
                        setVoiceType(item)
                      }
                      className={`rounded-2xl p-5 border transition-all text-left
                      ${
                        voiceType === item
                          ? "border-pink-500 bg-pink-500/10"
                          : "border-white/10 bg-black/30 hover:border-pink-500"
                      }`}
                    >
                      {item}
                    </button>

                  ))}

                </div>

              </div>

              {/* EMOÇÃO */}

              <div>

                <h2 className="text-2xl font-bold mb-6">
                  ✨ Emoção da música
                </h2>

                <div className="grid md:grid-cols-2 gap-4">

                  {[
                    "💖 Muito emocionante",
                    "🥹 Romântica",
                    "☀️ Feliz",
                    "🎉 Divertida",
                    "🌙 Delicada",
                    "🔥 Intensa",
                    "😭 Saudade",
                    "🙏 Inspiradora",
                  ].map((item) => (

                    <button
                      key={item}
                      onClick={() =>
                        setEmotion(item)
                      }
                      className={`rounded-2xl p-5 border transition-all text-left
                      ${
                        emotion === item
                          ? "border-pink-500 bg-pink-500/10"
                          : "border-white/10 bg-black/30 hover:border-pink-500"
                      }`}
                    >
                      {item}
                    </button>

                  ))}

                </div>

              </div>

            </div>

          )}

          {/* ================================================= */}
          {/* STEP 4 */}
          {/* ================================================= */}

          {step === 4 && (

            <div>

              <h1 className="text-5xl font-bold mb-5">
                Seus dados ❤️
              </h1>

              <p className="text-xl text-gray-400 mb-12">
                Informe os dados para envio da música.
              </p>

              <div className="grid md:grid-cols-2 gap-6">

                <input
                  value={nome}
                  onChange={(e) =>
                    setNome(e.target.value)
                  }
                  placeholder="Seu nome"
                  className="bg-black/40 border border-white/10 rounded-3xl px-6 py-5 text-lg outline-none focus:border-pink-500"
                />

                <input
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="Seu e-mail"
                  className="bg-black/40 border border-white/10 rounded-3xl px-6 py-5 text-lg outline-none focus:border-pink-500"
                />

                <input
                  value={whatsapp}
                  onChange={(e) =>
                    setWhatsapp(e.target.value)
                  }
                  placeholder="WhatsApp com DDD"
                  className="bg-black/40 border border-white/10 rounded-3xl px-6 py-5 text-lg outline-none focus:border-pink-500"
                />

              </div>

            </div>

          )}

          {/* ================================================= */}
          {/* STEP 5 */}
          {/* ================================================= */}

          {step === 5 && (

            <div>

              <div className="text-center mb-12">

                <h1 className="text-5xl font-bold mb-5">
                  Resumo da sua música 🎶
                </h1>

                <p className="text-xl text-gray-400">
                  Confira todas as informações.
                </p>

              </div>

              <div className="bg-black/40 border border-white/10 rounded-[40px] p-8 whitespace-pre-wrap text-gray-300 leading-relaxed">

                {resumoIA}

              </div>

            </div>

          )}

        </div>

        {/* ERROR */}

        {error && (

          <div className="mt-8 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl p-5 text-lg">
            {error}
          </div>

        )}

        {/* BUTTONS */}

        <div className="flex justify-between items-center mt-12">

          {step > 1 ? (

            <button
              onClick={prevStep}
              className="border border-white/10 hover:bg-white/10 transition-all px-8 py-4 rounded-2xl text-lg"
            >
              Voltar
            </button>

          ) : (
            <div />
          )}

          {step < 5 ? (

            <button
              onClick={nextStep}
              className="bg-pink-500 hover:bg-pink-600 transition-all px-10 py-4 rounded-2xl text-lg font-semibold shadow-lg shadow-pink-500/20"
            >
              Continuar
            </button>

          ) : (

            <button
              className="bg-pink-500 hover:bg-pink-600 transition-all px-10 py-4 rounded-2xl text-lg font-semibold shadow-lg shadow-pink-500/20"
            >
              Finalizar pedido ❤️
            </button>

          )}

        </div>

      </section>

    </div>

  )
}