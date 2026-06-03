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
    <div className="text-white font-sans" style={{ background: "#07060d" }}>

      {/* Gradiente de fundo — fixo atrás de tudo */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[55vw] h-[55vw] rounded-full blur-[120px] opacity-30"
             style={{ background: "radial-gradient(circle, #f0196b 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[45vw] h-[45vw] rounded-full blur-[120px] opacity-20"
             style={{ background: "radial-gradient(circle, #d946ef 0%, transparent 70%)" }} />
        <div className="absolute top-[40%] right-[20%] w-[30vw] h-[30vw] rounded-full blur-[100px] opacity-10"
             style={{ background: "radial-gradient(circle, #f0196b 0%, transparent 70%)" }} />
      </div>

      {/* Header — desktop only */}
      <div className="hidden lg:block">
        <Header showButton={false} progress={progress} />
      </div>

      {/*
        Container único adaptativo:
        Mobile  → fixed tela cheia, flex-col
        Desktop → static, fluxo normal, pt-40
      */}
      <div className="fixed inset-0 z-10 flex flex-col overflow-x-hidden lg:static lg:inset-auto lg:z-auto lg:block lg:min-h-screen lg:pt-24"
           style={{ background: "#07060d" }}>

        {/* ── Mobile: barra de progresso + topo ── */}
        <div className="lg:hidden shrink-0">
          <div className="h-[2px] w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-full transition-all duration-500"
                 style={{ width: `${progress}%`, background: "linear-gradient(90deg, #f0196b, #d946ef)" }} />
          </div>
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            {step > 1 ? (
              <button onClick={prevStep} disabled={submitting}
                      className="text-white/50 text-sm disabled:opacity-30">← Voltar</button>
            ) : <div />}
            <span className="text-xs text-white/55 font-medium">{step} / {totalSteps}</span>
            <div />
          </div>
        </div>

        {/* ── Área de conteúdo ── */}
        <div className="flex-1 overflow-y-auto lg:overflow-visible">
          <div className="px-5 py-4 pb-32 lg:pb-0 lg:max-w-3xl lg:mx-auto lg:px-6 lg:py-12">
            <div className="wizard-card">
              <div className="py-2 lg:py-0">

          {/* ===== STEP 1 — Ocasião ===== */}
          {step === 1 && (
            <div>
              <div className="mb-8">
                <h1 className="text-2xl lg:text-3xl font-bold mb-1 tracking-tight">
                  Selecione a ocasião que deseja homenagear
                </h1>
                <p className="text-white/55 text-sm">
                  Escolha abaixo e preencha o questionário guiado.
                </p>
              </div>

              <div className="space-y-2">
                {occasions.map((occasion) => (
                  <div
                    key={occasion.id}
                    className={`border rounded-2xl overflow-hidden transition-all ${
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
                      className="w-full px-4 py-3.5 flex items-center justify-between text-left"
                    >
                      <h2 className="text-base font-semibold">
                        {occasion.emoji} {occasion.label}
                      </h2>
                      <span className="text-lg text-pink-500 shrink-0 ml-2">
                        {selectedContext === occasion.label ? "−" : "+"}
                      </span>
                    </button>

                    {selectedContext === occasion.label && (
                      <div className="px-4 pb-4">
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
              <div className="mb-5">
                <h1 className="text-xl font-bold tracking-tight">Conte sua história</h1>
              </div>

              <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-pink-400 font-medium">
                    Pergunta {questionStep + 1} de {questions.length}
                  </span>
                  <div className="flex gap-1">
                    {questions.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                          i < questionStep
                            ? "bg-pink-500 w-4"
                            : i === questionStep
                            ? "bg-pink-400 w-6"
                            : "bg-white/20 w-3"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <h2 className="text-base font-bold mb-3">{currentQuestion}</h2>

                <textarea
                  rows={4}
                  value={answers[currentQuestion] || ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [currentQuestion]: e.target.value })
                  }
                  placeholder="Escreva com carinho… cada detalhe faz diferença ❤️"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-pink-500 resize-none transition-colors placeholder:text-white/30"
                />
              </div>
            </div>
          )}

          {/* ===== STEP 3 — Estilo musical ===== */}
          {step === 3 && (
            <div>
              <div className="mb-4">
                <h1 className="text-xl font-bold tracking-tight">Defina o estilo</h1>
              </div>

              {/* Estilo */}
              <div className="mb-4">
                <h2 className="text-[0.65rem] font-semibold mb-2 uppercase tracking-widest" style={{ color: "#f0196b" }}>Estilo musical</h2>
                <select
                  value={musicalStyle}
                  onChange={(e) => setMusicalStyle(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none appearance-none cursor-pointer transition-colors"
                  style={{
                    background: musicalStyle ? "rgba(240,25,107,0.08)" : "rgba(0,0,0,0.3)",
                    border: musicalStyle ? "1px solid rgba(240,25,107,0.5)" : "1px solid rgba(255,255,255,0.1)",
                    color: musicalStyle ? "white" : "rgba(255,255,255,0.4)",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23f0196b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 14px center",
                    paddingRight: "2.5rem",
                  }}
                >
                  <option value="" disabled style={{ background: "#07060d" }}>Selecione o estilo…</option>
                  {[
                    "🎤 Sertanejo", "🎶 Pagode", "💖 Pop",
                    "🪗 Forró",     "🎸 Rock",   "🎹 MPB",
                    "🙏 Gospel",   "🎧 Funk",   "🔥 Trap",
                    "🎙️ Rap",      "🎙️ Dance",  "🎷 Jazz",
                    "🌎 Internacional",
                  ].map((item) => (
                    <option key={item} value={item} style={{ background: "#07060d" }}>{item}</option>
                  ))}
                </select>
              </div>

              {/* Voz */}
              <div className="mb-4">
                <h2 className="text-[0.65rem] font-semibold mb-2 uppercase tracking-widest" style={{ color: "#f0196b" }}>Tipo de voz</h2>
                <div className="grid grid-cols-2 gap-2 max-w-sm">
                  {["👨 Masculina", "👩 Feminina"].map((item) => (
                    <button
                      key={item}
                      onClick={() => setVoiceType(item)}
                      className={`rounded-xl px-3 py-2.5 border transition-all text-left text-sm font-medium ${
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
                <h2 className="text-[0.65rem] font-semibold mb-2 uppercase tracking-widest" style={{ color: "#f0196b" }}>Emoção da música</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
                      className={`rounded-xl px-3 py-2.5 border transition-all text-left text-sm font-medium ${
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
              <div className="mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-5"
                     style={{ background: "rgba(240,25,107,0.1)", border: "1px solid rgba(240,25,107,0.25)", color: "#ff6b9d" }}>
                  Seus dados
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold mb-3 tracking-tight">
                  Quase lá!
                </h1>
                <p className="text-white/60 text-base">
                  Para entrarmos em contato e entregar sua música.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm text-gray-200 font-medium pl-2">
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
                  <label className="text-sm text-gray-200 font-medium pl-2">
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
                  <label className="text-sm text-gray-200 font-medium pl-2">
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

              <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-5 text-sm text-gray-200 leading-relaxed">
                🔒 Seus dados são privados e usados exclusivamente para entrega da sua música.
              </div>
            </div>
          )}

          {/* ===== STEP 5 — Resumo ===== */}
          {step === 5 && (
            <div>
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-5"
                     style={{ background: "rgba(240,25,107,0.1)", border: "1px solid rgba(240,25,107,0.25)", color: "#ff6b9d" }}>
                  Revisão final
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold mb-3 tracking-tight">
                  Tudo pronto!
                </h1>
                <p className="text-white/60 text-base">
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
                  <p className="text-xs text-gray-200 font-medium mb-1 uppercase tracking-wider">
                    Estilo
                  </p>
                  <p className="font-semibold">{musicalStyle}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <p className="text-xs text-gray-200 font-medium mb-1 uppercase tracking-wider">
                    Emoção
                  </p>
                  <p className="font-semibold">{emotion}</p>
                </div>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-[28px] p-8 whitespace-pre-wrap text-gray-300 leading-relaxed text-sm max-h-80 overflow-y-auto mb-6">
                {resumo}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4 text-sm text-gray-200">
                <span className="text-2xl">👤</span>
                <span>
                  <strong className="text-white">{nome}</strong> · {email} · {whatsapp}
                </span>
              </div>
            </div>
          )}

            </div>{/* fecha wizard-card inner */}
            </div>{/* fecha wizard-card */}

            {/* Erro */}
            {error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl p-4 text-sm">
                ⚠️ {error}
              </div>
            )}

            {/* Botões de navegação — desktop */}
            <div className="hidden lg:flex justify-between items-center mt-10">
              {step > 1 ? (
                <button onClick={prevStep} disabled={submitting}
                        className="transition-all px-7 py-3.5 rounded-2xl text-sm font-medium text-white/60 hover:text-white disabled:opacity-40"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
                  ← Voltar
                </button>
              ) : <div />}
              {step !== 1 && step < 5 && (
                <button onClick={nextStep}
                        className="transition-all px-9 py-3.5 rounded-2xl text-sm font-semibold text-white"
                        style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 4px 20px rgba(240,25,107,0.35)" }}>
                  Continuar →
                </button>
              )}
              {step === 5 && (
                <button onClick={handleFinalizar} disabled={submitting}
                        className="transition-all px-9 py-3.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-60 flex items-center gap-3"
                        style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 4px 24px rgba(240,25,107,0.4)" }}>
                  {submitting ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enviando…</>
                  ) : "Finalizar e escolher produto →"}
                </button>
              )}
            </div>

          </div>{/* fecha px-5/lg:max-w-3xl */}
        </div>{/* fecha flex-1 overflow-y-auto */}

        {/* Botão fixo no rodapé — mobile */}
        {step !== 1 && (
          <div className="lg:hidden shrink-0 px-5 py-4 border-t border-white/[0.06]"
               style={{ background: "rgba(7,6,13,0.95)", backdropFilter: "blur(16px)" }}>
            {step < 5 ? (
              <button onClick={nextStep}
                      className="w-full py-4 rounded-2xl text-sm font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 4px 20px rgba(240,25,107,0.35)" }}>
                Continuar →
              </button>
            ) : (
              <button onClick={handleFinalizar} disabled={submitting}
                      className="w-full py-4 rounded-2xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-3"
                      style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 4px 24px rgba(240,25,107,0.4)" }}>
                {submitting ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enviando…</>
                ) : "Finalizar e escolher produto →"}
              </button>
            )}
          </div>
        )}

        {/* Footer — desktop only */}
        <div className="hidden lg:block">
          <Footer />
        </div>

      </div>{/* fecha container adaptativo */}
    </div>
  )
}

