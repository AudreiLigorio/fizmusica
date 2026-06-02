"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Header from "../components/Header"
import Footer from "../components/Footer"
import type { CreateOrderDTO } from "@/app/types/order"

type WizardQuestion    = { id: string; label: string; sort_order: number }
type WizardSubcategory = { id: string; label: string; emoji: string; slug: string; sort_order: number; wizard_questions: WizardQuestion[] }
type WizardOccasion    = { id: string; label: string; emoji: string; slug: string; wizard_subcategories: WizardSubcategory[] }

export default function CriarMusicaPage() {

  const router = useRouter()

  const [occasions, setOccasions] = useState<WizardOccasion[]>([])
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
  const [honoreeName, setHonoreeName] = useState("")
  const [error, setError] = useState("")
  const [questionStep, setQuestionStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch("/api/wizard")
      .then((r) => r.json())
      .then((d) => setOccasions(d.occasions ?? []))
  }, [])

  /* ================================================= */
  /* QUESTIONS                                         */
  /* ================================================= */

  const questions = useMemo((): string[] => {
    if (!selectedContext || !selectedSubcategory) return []
    const occasion = occasions.find((o) => o.label === selectedContext)
    const sub = occasion?.wizard_subcategories.find((s) => s.label === selectedSubcategory)
    return sub?.wizard_questions.map((q) => q.label) ?? []
  }, [selectedContext, selectedSubcategory, occasions])

  const currentQuestion = questions[questionStep]

  /* ================================================= */
  /* PROGRESS                                          */
  /* ================================================= */

  const totalSteps = 5
  const internalQuestionProgress =
    step === 2 ? questionStep / Math.max(questions.length, 1) : 0
  const progress =
    ((step - 1 + internalQuestionProgress) / totalSteps) * 100

  /* ================================================= */
  /* NEXT STEP                                         */
  /* ================================================= */

  const nextStep = () => {
    setError("")

    if (step === 1) {
      if (!selectedContext || !selectedSubcategory) {
        setError("Selecione uma ocasião para continuar.")
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
      if (!nome.trim() || !email.trim() || !whatsapp.trim()) {
        setError("Preencha todos os seus dados.")
        return
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        setError("E-mail inválido.")
        return
      }
    }

    setStep(step + 1)
  }

  const prevStep = () => {
    setError("")
    if (step === 2 && questionStep > 0) {
      setQuestionStep(questionStep - 1)
    } else {
      setStep(step - 1)
    }
  }

  /* ================================================= */
  /* FINALIZAR — salva no banco e vai para produtos    */
  /* ================================================= */

  const handleFinalizar = async () => {
    setError("")
    setSubmitting(true)

    const payload: CreateOrderDTO = {
      nome,
      email,
      whatsapp,
      context: selectedContext,
      subcategory: selectedSubcategory,
      musicalStyle,
      voiceType,
      emotion,
      honoreeName: honoreeName.trim() || undefined,
      answers: questions.map((q, i) => ({
        question: q,
        answer: answers[q] ?? "",
        position: i,
        context: selectedContext,
        subcategory: selectedSubcategory,
      })),
    }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error ?? "Erro ao enviar. Tente novamente.")
        setSubmitting(false)
        return
      }

      // Redireciona para escolha de produto
      router.push(`/produtos?orderId=${data.orderId}`)
    } catch {
      setError("Falha de conexão. Verifique sua internet.")
      setSubmitting(false)
    }
  }

  /* ================================================= */
  /* RESUMO                                            */
  /* ================================================= */

  const resumo = `CONTEXTO: ${selectedContext}
SUBCATEGORIA: ${selectedSubcategory}

${questions.map((q) => `${q}\n${answers[q] ?? ""}`).join("\n\n")}

ESTILO MUSICAL: ${musicalStyle}
TIPO DE VOZ: ${voiceType}
EMOÇÃO: ${emotion}

NOME: ${nome}
E-MAIL: ${email}
WHATSAPP: ${whatsapp}`

  /* ================================================= */
  /* RENDER                                            */
  /* ================================================= */

  return (
    <div className="min-h-screen bg-black text-white font-sans pt-40">
      <Header showButton={false} />

      {/* BARRA DE PROGRESSO */}
      <div className="fixed top-[73px] left-0 right-0 z-40 h-1 bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-pink-500 to-fuchsia-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 lg:p-12 backdrop-blur-xl">

          {/* ===== STEP 1 — Ocasião ===== */}
          {step === 1 && (
            <div>
              <div className="text-center mb-14">
                <h1 className="text-5xl font-bold mb-5">
                  Vamos criar sua Música ❤️
                </h1>
                <div className="bg-pink-500/10 border border-pink-500/20 rounded-3xl p-6 max-w-2xl mx-auto">
                  <p className="text-gray-200 text-lg leading-relaxed mb-4">
                    ✨ Preencha com carinho cada detalhe da sua história.
                  </p>
                  <p className="text-gray-400 leading-relaxed mb-5">
                    Quanto mais informações você compartilhar,
                    mais emocionante e especial ficará sua música ❤️
                  </p>
                  <div className="inline-flex items-center gap-2 bg-black/40 border border-white/10 px-5 py-3 rounded-2xl text-pink-300 font-medium">
                    🎵 Selecione a ocasião que deseja homenagear:
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {occasions.map((occasion) => (
                  <div
                    key={occasion.id}
                    className={`border rounded-3xl overflow-hidden transition-all ${
                      selectedContext === occasion.label
                        ? "border-pink-500 bg-pink-500/5"
                        : "border-white/10 bg-black/20"
                    }`}
                  >
                    <button
                      onClick={() =>
                        setSelectedContext(
                          selectedContext === occasion.label ? "" : occasion.label
                        )
                      }
                      className="w-full p-7 flex items-center justify-between text-left"
                    >
                      <h2 className="text-2xl font-bold">
                        {occasion.emoji} {occasion.label}
                      </h2>
                      <span className="text-2xl text-pink-500">
                        {selectedContext === occasion.label ? "−" : "+"}
                      </span>
                    </button>

                    {selectedContext === occasion.label && (
                      <div className="px-7 pb-7">
                        {/* Campo homenageado */}
                        <div className="mb-5">
                          <label className="text-sm text-gray-400 font-medium pl-1 block mb-2">
                            🎁 Nome de quem vai receber a música (opcional)
                          </label>
                          <input
                            value={honoreeName}
                            onChange={(e) => setHonoreeName(e.target.value)}
                            placeholder="Ex: Ana, vovó Bete, meu amor…"
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-base outline-none focus:border-pink-500 transition-colors"
                          />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                        {occasion.wizard_subcategories.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => {
                              setSelectedSubcategory(sub.label)
                              setQuestionStep(0)
                              setAnswers({})
                              setTimeout(() => setStep(2), 150)
                            }}
                            className={`rounded-2xl p-5 border transition-all text-left ${
                              selectedSubcategory === sub.label
                                ? "border-pink-500 bg-pink-500/10"
                                : "border-white/10 bg-black/30 hover:border-pink-500"
                            }`}
                          >
                            {sub.emoji} {sub.label}
                          </button>
                        ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== STEP 2 — Perguntas ===== */}
          {step === 2 && (
            <div>
              <div className="mb-10">
                <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 px-4 py-2 rounded-full text-pink-300 text-sm font-medium mb-5">
                  {selectedContext} · {selectedSubcategory}
                </div>
                <h1 className="text-5xl font-bold mb-3">
                  Conte sua história ❤️
                </h1>
                <p className="text-xl text-gray-400">
                  Quanto mais detalhes, mais especial ficará sua música.
                </p>
              </div>

              <div className="bg-black/30 border border-white/10 rounded-[28px] p-8">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm text-pink-400 font-medium">
                    Pergunta {questionStep + 1} de {questions.length}
                  </span>
                  <div className="flex gap-1">
                    {questions.map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i < questionStep
                            ? "bg-pink-500"
                            : i === questionStep
                            ? "bg-pink-400 w-4"
                            : "bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <h2 className="text-3xl font-bold mb-6">{currentQuestion}</h2>

                <textarea
                  rows={5}
                  value={answers[currentQuestion] || ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [currentQuestion]: e.target.value })
                  }
                  placeholder="Escreva com carinho… cada detalhe faz diferença ❤️"
                  className="w-full bg-black/40 border border-white/10 rounded-3xl p-6 text-lg outline-none focus:border-pink-500 resize-none transition-colors placeholder:text-gray-600"
                />
              </div>
            </div>
          )}

          {/* ===== STEP 3 — Estilo musical ===== */}
          {step === 3 && (
            <div>
              <h1 className="text-5xl font-bold mb-3">
                Defina o estilo da música 🎵
              </h1>
              <p className="text-xl text-gray-400 mb-12">
                Escolha o clima perfeito para sua história.
              </p>

              {/* Estilo */}
              <div className="mb-10">
                <h2 className="text-2xl font-bold mb-5">🎶 Estilo musical</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    "🎤 Sertanejo", "🎶 Pagode", "💖 Pop",
                    "🪗 Forró",     "🎸 Rock",   "🎹 MPB",
                    "🙏 Gospel",   "🎧 Funk",   "🔥 Trap",
                    "🎙️ Rap",      "🎙️ Dance",  "🎷 Jazz",
                    "🌎 Internacional",
                  ].map((item) => (
                    <button
                      key={item}
                      onClick={() => setMusicalStyle(item)}
                      className={`rounded-2xl p-4 border transition-all text-left font-medium ${
                        musicalStyle === item
                          ? "border-pink-500 bg-pink-500/10 text-white"
                          : "border-white/10 bg-black/30 hover:border-pink-500/50 text-gray-300"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voz */}
              <div className="mb-10">
                <h2 className="text-2xl font-bold mb-5">🎤 Tipo de voz</h2>
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  {["👨 Masculina", "👩 Feminina"].map((item) => (
                    <button
                      key={item}
                      onClick={() => setVoiceType(item)}
                      className={`rounded-2xl p-4 border transition-all text-left font-medium ${
                        voiceType === item
                          ? "border-pink-500 bg-pink-500/10 text-white"
                          : "border-white/10 bg-black/30 hover:border-pink-500/50 text-gray-300"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Emoção */}
              <div>
                <h2 className="text-2xl font-bold mb-5">✨ Emoção da música</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    "💖 Muito emocionante", "🥹 Romântica",
                    "☀️ Alegre & Feliz",    "🎉 Divertida",
                    "🌙 Delicada",          "😭 Profunda",
                    "🔥 Intensa",           "😢 Saudade",
                    "🙏 Inspiradora",
                  ].map((item) => (
                    <button
                      key={item}
                      onClick={() => setEmotion(item)}
                      className={`rounded-2xl p-4 border transition-all text-left font-medium ${
                        emotion === item
                          ? "border-pink-500 bg-pink-500/10 text-white"
                          : "border-white/10 bg-black/30 hover:border-pink-500/50 text-gray-300"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== STEP 4 — Dados de contato ===== */}
          {step === 4 && (
            <div>
              <h1 className="text-5xl font-bold mb-3">Seus dados ❤️</h1>
              <p className="text-xl text-gray-400 mb-12">
                Para entrarmos em contato e entregar sua música.
              </p>

              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium pl-2">
                    Seu nome completo
                  </label>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full bg-black/40 border border-white/10 rounded-3xl px-6 py-5 text-lg outline-none focus:border-pink-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium pl-2">
                    Seu e-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: joao@email.com"
                    className="w-full bg-black/40 border border-white/10 rounded-3xl px-6 py-5 text-lg outline-none focus:border-pink-500 transition-colors"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm text-gray-400 font-medium pl-2">
                    WhatsApp com DDD
                  </label>
                  <input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="Ex: (11) 99999-9999"
                    className="w-full bg-black/40 border border-white/10 rounded-3xl px-6 py-5 text-lg outline-none focus:border-pink-500 transition-colors max-w-sm"
                  />
                </div>
              </div>

              <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-5 text-sm text-gray-400 leading-relaxed">
                🔒 Seus dados são privados e usados exclusivamente para entrega da sua música.
              </div>
            </div>
          )}

          {/* ===== STEP 5 — Resumo ===== */}
          {step === 5 && (
            <div>
              <div className="text-center mb-10">
                <h1 className="text-5xl font-bold mb-3">
                  Tudo pronto! 🎶
                </h1>
                <p className="text-xl text-gray-400">
                  Confira o resumo antes de finalizar.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <div className="bg-pink-500/10 border border-pink-500/20 rounded-2xl p-5">
                  <p className="text-xs text-pink-400 font-medium mb-1 uppercase tracking-wider">
                    Ocasião
                  </p>
                  <p className="font-semibold">{selectedSubcategory}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <p className="text-xs text-gray-400 font-medium mb-1 uppercase tracking-wider">
                    Estilo
                  </p>
                  <p className="font-semibold">{musicalStyle}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <p className="text-xs text-gray-400 font-medium mb-1 uppercase tracking-wider">
                    Emoção
                  </p>
                  <p className="font-semibold">{emotion}</p>
                </div>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-[28px] p-8 whitespace-pre-wrap text-gray-300 leading-relaxed text-sm max-h-80 overflow-y-auto mb-6">
                {resumo}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4 text-sm text-gray-400">
                <span className="text-2xl">👤</span>
                <span>
                  <strong className="text-white">{nome}</strong> · {email} · {whatsapp}
                </span>
              </div>
            </div>
          )}

        </div>

        {/* ERRO */}
        {error && (
          <div className="mt-6 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl p-5">
            ⚠️ {error}
          </div>
        )}

        {/* BOTÕES DE NAVEGAÇÃO */}
        <div className="flex justify-between items-center mt-10">
          {step > 1 ? (
            <button
              onClick={prevStep}
              disabled={submitting}
              className="border border-white/10 hover:bg-white/10 transition-all px-8 py-4 rounded-2xl text-lg disabled:opacity-40"
            >
              ← Voltar
            </button>
          ) : (
            <div />
          )}

          {step !== 1 && step < 5 && (
            <button
              onClick={nextStep}
              className="bg-pink-500 hover:bg-pink-600 transition-all px-10 py-4 rounded-2xl text-lg font-semibold shadow-lg shadow-pink-500/20"
            >
              Continuar →
            </button>
          )}

          {step === 5 && (
            <button
              onClick={handleFinalizar}
              disabled={submitting}
              className="bg-pink-500 hover:bg-pink-600 transition-all px-10 py-4 rounded-2xl text-lg font-semibold shadow-2xl shadow-pink-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-3"
            >
              {submitting ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando…
                </>
              ) : (
                "Finalizar e escolher produto ❤️"
              )}
            </button>
          )}
        </div>

      </section>
      <Footer />
    </div>
  )
}
