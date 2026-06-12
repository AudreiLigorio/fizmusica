"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Header from "../components/Header"
import Footer from "../components/Footer"
import type { CreateOrderDTO } from "@/app/types/order"

type WizardQuestion    = { id: string; label: string; sort_order: number }
type WizardSubcategory = { id: string; label: string; emoji: string; slug: string; sort_order: number; wizard_questions: WizardQuestion[] }
type WizardOccasion    = { id: string; label: string; emoji: string; slug: string; wizard_subcategories: WizardSubcategory[] }

type SessionData = {
  step: number
  questionStep: number
  selectedContext: string
  selectedSubcategory: string
  answers: Record<string, string>
  musicalStyle: string
  voiceType: string
  emotion: string
  nome: string
  email: string
  whatsapp: string
  honoreeName: string
  leadCaptured?: boolean
}

const SESSION_KEY = "fizmusica_session_id"

function maskWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length === 0) return ""
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export default function CriarMusicaPage() {

  const router = useRouter()
  const searchParams = useSearchParams()

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

  // Session persistence
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [resumeBanner, setResumeBanner] = useState<SessionData | null>(null)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lead capture (após 3ª pergunta respondida)
  const [showLeadCapture, setShowLeadCapture] = useState(false)
  const [leadCaptured, setLeadCaptured] = useState(false)
  const [leadNome, setLeadNome] = useState("")
  const [leadEmail, setLeadEmail] = useState("")
  const [leadWhatsapp, setLeadWhatsapp] = useState("")
  const [leadHonoreeName, setLeadHonoreeName] = useState("")
  const [leadError, setLeadError] = useState("")

  const leadWhatsappOk = /^\(\d{2}\) 9\d{4}-\d{4}$/.test(leadWhatsapp)
  const leadWhatsappDirty = leadWhatsapp.length > 0
  const leadEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)
  const leadEmailDirty = leadEmail.length > 0

  useEffect(() => {
    fetch("/api/wizard")
      .then((r) => r.json())
      .then((d) => setOccasions(d.occasions ?? []))
  }, [])

  // Ao montar: verifica ?sessao=UUID (link de e-mail de recuperação) ou localStorage
  useEffect(() => {
    const urlSessionId = searchParams.get("sessao")
    const storedId = urlSessionId ?? localStorage.getItem(SESSION_KEY)
    if (!storedId) return

    fetch(`/api/wizard-session?id=${storedId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const s = json?.session
        if (!s || !s.data) return

        if (urlSessionId) {
          // Veio pelo link do e-mail — restaura diretamente sem banner
          localStorage.setItem(SESSION_KEY, urlSessionId)
          setSessionId(urlSessionId)
          resumeSessionData(s.data, s.step)
          return
        }

        if (s.step <= 1) {
          setSessionId(storedId)
          return
        }
        setResumeBanner({ ...s.data, step: s.step })
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ================================================= */
  /* SESSION HELPERS                                   */
  /* ================================================= */

  function buildSessionData(overrides: Partial<SessionData> = {}): SessionData {
    return {
      step,
      questionStep,
      selectedContext,
      selectedSubcategory,
      answers,
      musicalStyle,
      voiceType,
      emotion,
      nome,
      email,
      whatsapp,
      honoreeName,
      leadCaptured,
      ...overrides,
    }
  }

  function initSession(id: string) {
    localStorage.setItem(SESSION_KEY, id)
    setSessionId(id)
    fetch("/api/wizard-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, step: 1, data: {} }),
    }).catch(() => {})
  }

  function saveSession(data: SessionData, currentStep: number, id?: string) {
    const sid = id ?? sessionId
    if (!sid) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      fetch("/api/wizard-session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sid, step: currentStep, data }),
      }).catch(() => {})
    }, 500)
  }

  function clearSession() {
    const sid = localStorage.getItem(SESSION_KEY)
    localStorage.removeItem(SESSION_KEY)
    if (sid) {
      fetch(`/api/wizard-session?id=${sid}`, { method: "DELETE" }).catch(() => {})
    }
    setSessionId(null)
  }

  function resumeSessionData(data: Partial<SessionData>, step: number) {
    setStep(step)
    setQuestionStep(data.questionStep ?? 0)
    setSelectedContext(data.selectedContext ?? "")
    setSelectedSubcategory(data.selectedSubcategory ?? "")
    setAnswers(data.answers ?? {})
    setMusicalStyle(data.musicalStyle ?? "")
    setVoiceType(data.voiceType ?? "")
    setEmotion(data.emotion ?? "")
    setNome(data.nome ?? "")
    setEmail(data.email ?? "")
    setWhatsapp(data.whatsapp ?? "")
    setHonoreeName(data.honoreeName ?? "")
    setLeadCaptured(data.leadCaptured ?? false)
  }

  function resumeSession(s: SessionData) {
    resumeSessionData(s, s.step)
    setResumeBanner(null)
    const storedId = localStorage.getItem(SESSION_KEY)
    if (storedId) setSessionId(storedId)
  }

  function startFresh() {
    clearSession()
    setResumeBanner(null)
    setStep(1)
    setQuestionStep(0)
    setSelectedContext("")
    setSelectedSubcategory("")
    setAnswers({})
    setMusicalStyle("")
    setVoiceType("")
    setEmotion("")
    setNome("")
    setEmail("")
    setWhatsapp("")
    setHonoreeName("")
    setLeadCaptured(false)
    setShowLeadCapture(false)
    const newId = crypto.randomUUID()
    initSession(newId)
  }

  /* ================================================= */
  /* LEAD CAPTURE                                      */
  /* ================================================= */

  function handleLeadSave() {
    setLeadError("")

    if (!leadNome.trim()) { setLeadError("Informe seu nome."); return }
    if (!leadEmail.trim() || !leadEmailOk) { setLeadError("E-mail inválido."); return }
    if (!leadWhatsappOk) { setLeadError("WhatsApp inválido. Use o formato (XX) 9XXXX-XXXX."); return }

    // Preenche os campos finais para não repetir digitação
    setNome(leadNome)
    setEmail(leadEmail)
    setWhatsapp(leadWhatsapp)
    setHonoreeName(leadHonoreeName)
    setLeadCaptured(true)
    setShowLeadCapture(false)

    // Salva o lead na sessão imediatamente
    const data = buildSessionData({
      nome: leadNome,
      email: leadEmail,
      whatsapp: leadWhatsapp,
      honoreeName: leadHonoreeName,
      leadCaptured: true,
    })
    saveSession(data, step)

    // Avança para a próxima pergunta
    advanceQuestion()
  }

  function handleLeadSkip() {
    setLeadCaptured(true) // não mostra mais
    setShowLeadCapture(false)
    advanceQuestion()
  }

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

  function advanceQuestion() {
    if (questionStep < questions.length - 1) {
      const nextQ = questionStep + 1
      setQuestionStep(nextQ)
      saveSession(buildSessionData({ questionStep: nextQ }), step)
    } else {
      const nextSt = 3
      setStep(nextSt)
      saveSession(buildSessionData({ step: nextSt }), nextSt)
    }
  }

  const nextStep = () => {
    setError("")

    if (step === 1) {
      if (!selectedContext || !selectedSubcategory) {
        setError("Selecione uma ocasião para continuar.")
        return
      }
    }

    if (step === 2) {
      if (!answers[currentQuestion] || answers[currentQuestion].trim().length < 3) {
        setError("Responda a pergunta para continuar.")
        return
      }

      // Exibe captura de lead após a 3ª pergunta, apenas uma vez
      if (questionStep === 2 && !leadCaptured) {
        setShowLeadCapture(true)
        return
      }

      advanceQuestion()
      return
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
      const whatsappRegex = /^\(\d{2}\) 9\d{4}-\d{4}$/
      if (!whatsappRegex.test(whatsapp)) {
        setError("WhatsApp inválido. Use o formato (XX) 9XXXX-XXXX.")
        return
      }
    }

    const nextSt = step + 1
    setStep(nextSt)
    saveSession(buildSessionData({ step: nextSt }), nextSt)
  }

  const whatsappOk = /^\(\d{2}\) 9\d{4}-\d{4}$/.test(whatsapp)
  const whatsappDirty = whatsapp.length > 0

  const prevStep = () => {
    setError("")
    if (step === 2 && questionStep > 0) {
      const prevQ = questionStep - 1
      setQuestionStep(prevQ)
      saveSession(buildSessionData({ questionStep: prevQ }), step)
    } else {
      const prevSt = step - 1
      setStep(prevSt)
      saveSession(buildSessionData({ step: prevSt }), prevSt)
    }
  }

  /* ================================================= */
  /* INIT SESSION on first subcategory click           */
  /* ================================================= */

  function handleSubcategoryClick(sub: WizardSubcategory, contextLabel: string) {
    setSelectedSubcategory(sub.label)
    setQuestionStep(0)
    setAnswers({})

    let sid = sessionId
    if (!sid) {
      sid = crypto.randomUUID()
      initSession(sid)
    }

    setTimeout(() => {
      setStep(2)
      saveSession(
        buildSessionData({
          step: 2,
          questionStep: 0,
          answers: {},
          selectedContext: contextLabel,
          selectedSubcategory: sub.label,
        }),
        2,
        sid!,
      )
    }, 150)
  }

  /* ================================================= */
  /* FINALIZAR                                         */
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

      clearSession()
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
WHATSAPP: ${whatsapp}${honoreeName ? `\nHOMENAGEADO: ${honoreeName}` : ""}`

  /* ================================================= */
  /* RENDER                                            */
  /* ================================================= */

  return (
    <div className="text-white font-sans" style={{ background: "#07060d" }}>

      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[55vw] h-[55vw] rounded-full blur-[120px] opacity-30"
             style={{ background: "radial-gradient(circle, #f0196b 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[45vw] h-[45vw] rounded-full blur-[120px] opacity-20"
             style={{ background: "radial-gradient(circle, #d946ef 0%, transparent 70%)" }} />
        <div className="absolute top-[40%] right-[20%] w-[30vw] h-[30vw] rounded-full blur-[100px] opacity-10"
             style={{ background: "radial-gradient(circle, #f0196b 0%, transparent 70%)" }} />
      </div>

      <div className="hidden lg:block">
        <Header showButton={false} progress={progress} />
      </div>

      <div className="fixed top-0 left-0 right-0 bottom-0 z-10 flex flex-col lg:static lg:inset-auto lg:z-auto lg:block lg:min-h-screen lg:pt-24"
           style={{ background: "#07060d", width: "100%", maxWidth: "100vw", overflowX: "hidden" }}>

        {/* ── Mobile: barra de progresso + topo ── */}
        <div className="lg:hidden shrink-0">
          <div className="h-[2px] w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-full transition-all duration-500"
                 style={{ width: `${progress}%`, background: "linear-gradient(90deg, #f0196b, #d946ef)" }} />
          </div>
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            {step > 1 && !showLeadCapture ? (
              <button onClick={prevStep} disabled={submitting}
                      className="text-white/50 text-sm disabled:opacity-30">← Voltar</button>
            ) : <div />}
            <span className="text-xs text-white/55 font-medium">{step} / {totalSteps}</span>
            <div />
          </div>
        </div>

        {/* ── Área de conteúdo ── */}
        <div className="flex-1 overflow-y-auto lg:overflow-visible" style={{ overflowX: "hidden", width: "100%" }}>
          <div className="px-5 py-4 pb-32 lg:pb-0 lg:max-w-3xl lg:mx-auto lg:px-6 lg:py-12" style={{ width: "100%", boxSizing: "border-box" }}>

            {/* ── Banner de retomada ── */}
            {resumeBanner && (
              <div className="mb-6 rounded-2xl p-5 border"
                   style={{ background: "rgba(240,25,107,0.08)", borderColor: "rgba(240,25,107,0.3)" }}>
                <p className="text-sm font-semibold text-white mb-1">
                  🎵 Encontramos sua música em andamento!
                </p>
                <p className="text-xs text-white/60 mb-4">
                  Você já havia respondido parte do formulário. Deseja continuar de onde parou?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => resumeSession(resumeBanner)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
                  >
                    Continuar de onde parei
                  </button>
                  <button
                    onClick={startFresh}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 border border-white/10"
                  >
                    Começar do zero
                  </button>
                </div>
              </div>
            )}

            <div className="wizard-card">
              <div className="py-2 lg:py-0">

          {/* ===== LEAD CAPTURE — aparece após 1ª pergunta ===== */}
          {showLeadCapture && (
            <div>
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 text-xs font-semibold"
                     style={{ background: "rgba(240,25,107,0.15)", color: "#f0196b" }}>
                  ✨ Sua história já está sendo construída
                </div>
                <h1 className="text-xl font-bold tracking-tight mb-2">
                  Informe seu contato para continuar de qualquer dispositivo
                </h1>
                <p className="text-white/50 text-sm">
                  Assim suas respostas ficam salvas e você não perde nada se precisar pausar.
                </p>
              </div>

              <div className="space-y-4">
                {/* Nome */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-200 font-medium pl-2">Seu nome completo</label>
                  <input
                    value={leadNome}
                    onChange={(e) => setLeadNome(e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full bg-black/40 border border-white/10 rounded-3xl px-6 py-4 text-base outline-none focus:border-pink-500 transition-colors"
                  />
                </div>

                {/* E-mail */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-200 font-medium pl-2">Seu e-mail</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      placeholder="Ex: joao@email.com"
                      className="w-full bg-black/40 rounded-3xl px-6 py-4 text-base outline-none transition-colors pr-12"
                      style={{
                        border: leadEmailDirty
                          ? leadEmailOk
                            ? "1px solid rgba(34,197,94,0.6)"
                            : "1px solid rgba(240,25,107,0.6)"
                          : "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                    {leadEmailDirty && (
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg">
                        {leadEmailOk ? "✅" : "❌"}
                      </span>
                    )}
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-200 font-medium pl-2">WhatsApp com DDD</label>
                  <div className="relative">
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={leadWhatsapp}
                      onChange={(e) => setLeadWhatsapp(maskWhatsapp(e.target.value))}
                      placeholder="(11) 99999-9999"
                      maxLength={16}
                      className="w-full bg-black/40 rounded-3xl px-6 py-4 text-base outline-none transition-colors pr-12"
                      style={{
                        border: leadWhatsappDirty
                          ? leadWhatsappOk
                            ? "1px solid rgba(34,197,94,0.6)"
                            : "1px solid rgba(240,25,107,0.6)"
                          : "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                    {leadWhatsappDirty && (
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg">
                        {leadWhatsappOk ? "✅" : "❌"}
                      </span>
                    )}
                  </div>
                  {leadWhatsappDirty && !leadWhatsappOk && (
                    <p className="text-xs pl-2" style={{ color: "#f0196b" }}>
                      Formato: (XX) 9XXXX-XXXX — somente celular
                    </p>
                  )}
                </div>

                {/* Nome do homenageado — destaque especial */}
                <div className="space-y-2 rounded-2xl p-4" style={{ background: "rgba(240,25,107,0.06)", border: "1px solid rgba(240,25,107,0.2)" }}>
                  <label className="text-sm font-semibold pl-1 flex items-center gap-2" style={{ color: "#f0196b" }}>
                    🎵 Para quem é essa música?
                  </label>
                  <p className="text-xs text-white/40 pl-1 -mt-1">Nome de quem vai receber a homenagem</p>
                  <input
                    value={leadHonoreeName}
                    onChange={(e) => setLeadHonoreeName(e.target.value)}
                    placeholder="Ex: Maria, Vovó Lúcia, Papai…"
                    className="w-full rounded-2xl px-5 py-3.5 text-base outline-none transition-colors"
                    style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(240,25,107,0.3)" }}
                  />
                </div>
              </div>

              {leadError && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl p-4 text-sm">
                  ⚠️ {leadError}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                <button
                  onClick={handleLeadSave}
                  className="w-full py-4 rounded-2xl text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 4px 20px rgba(240,25,107,0.35)" }}
                >
                  Salvar e continuar →
                </button>
                <button
                  onClick={handleLeadSkip}
                  className="w-full py-3 rounded-2xl text-sm text-white/40 hover:text-white/60 transition-colors"
                >
                  Pular por agora
                </button>
              </div>
            </div>
          )}

          {/* ===== STEP 1 — Ocasião ===== */}
          {!showLeadCapture && step === 1 && (
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
                      className="w-full px-4 py-3.5 flex items-start justify-between text-left gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold mb-1.5">
                          {occasion.emoji} {occasion.label}
                        </h2>
                        {selectedContext !== occasion.label && (
                          <div className="flex flex-wrap gap-1.5">
                            {occasion.wizard_subcategories.slice(0, 4).map((sub, i) => (
                              <span key={sub.id} className="text-[10px]"
                                style={{ color: "rgba(255,255,255,0.35)" }}>
                                {sub.label}{i < Math.min(3, occasion.wizard_subcategories.length - 1) ? " ·" : ""}
                              </span>
                            ))}
                            {occasion.wizard_subcategories.length > 4 && (
                              <span className="text-[10px]"
                                style={{ color: "rgba(240,25,107,0.55)" }}>
                                +{occasion.wizard_subcategories.length - 4} mais
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-lg text-pink-500 shrink-0 mt-0.5">
                        {selectedContext === occasion.label ? "−" : "+"}
                      </span>
                    </button>

                    {selectedContext === occasion.label && (
                      <div className="px-4 pb-4">
                        <div className="grid md:grid-cols-2 gap-4">
                        {occasion.wizard_subcategories.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => handleSubcategoryClick(sub, occasion.label)}
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
          {!showLeadCapture && step === 2 && (
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

                <button
                  onClick={nextStep}
                  className="lg:hidden w-full mt-3 py-3.5 rounded-2xl text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 4px 20px rgba(240,25,107,0.35)" }}
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* ===== STEP 3 — Estilo musical ===== */}
          {!showLeadCapture && step === 3 && (
            <div>
              <div className="mb-4">
                <h1 className="text-xl font-bold tracking-tight">Defina o estilo</h1>
              </div>

              <div className="mb-4">
                <h2 className="text-[0.65rem] font-semibold mb-2 uppercase tracking-widest" style={{ color: "#f0196b" }}>Estilo musical</h2>
                <select
                  value={musicalStyle}
                  onChange={(e) => setMusicalStyle(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 font-medium outline-none appearance-none cursor-pointer transition-colors"
                  style={{
                    fontSize: "16px",
                    background: musicalStyle ? "rgba(240,25,107,0.08)" : "rgba(255,255,255,0.07)",
                    border: musicalStyle ? "1px solid rgba(240,25,107,0.5)" : "1px solid rgba(255,255,255,0.25)",
                    color: musicalStyle ? "white" : "rgba(255,255,255,0.75)",
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

              <div className="mb-4">
                <h2 className="text-[0.65rem] font-semibold mb-2 uppercase tracking-widest" style={{ color: "#f0196b" }}>Tipo de voz</h2>
                <div className="grid grid-cols-2 gap-2 overflow-hidden">
                  {["👨 Masculina", "👩 Feminina"].map((item) => (
                    <button
                      key={item}
                      onClick={() => setVoiceType(item)}
                      className={`min-w-0 w-full rounded-xl px-3 py-2.5 border transition-all text-left text-sm font-medium overflow-hidden ${
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

              <div>
                <h2 className="text-[0.65rem] font-semibold mb-2 uppercase tracking-widest" style={{ color: "#f0196b" }}>Emoção da música</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 overflow-hidden">
                  {[
                    "💖 Emocionante",  "🥹 Romântica",
                    "☀️ Alegre",       "🎉 Divertida",
                    "🌙 Delicada",     "😭 Profunda",
                    "🔥 Intensa",      "😢 Saudade",
                    "🙏 Inspiradora",
                  ].map((item) => (
                    <button
                      key={item}
                      onClick={() => setEmotion(item)}
                      className={`min-w-0 w-full rounded-xl px-3 py-2.5 border transition-all text-left text-sm font-medium overflow-hidden ${
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
          {!showLeadCapture && step === 4 && (
            <div>
              <div className="mb-5">
                <h1 className="text-xl font-bold tracking-tight">
                  {leadCaptured && nome ? "Confirme seus dados para o envio" : "Preencha os dados para o envio"}
                </h1>
                {leadCaptured && nome && (
                  <p className="text-white/50 text-sm mt-1">Seus dados foram preenchidos automaticamente ✓</p>
                )}
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
                  <div className="relative max-w-sm">
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(maskWhatsapp(e.target.value))}
                      placeholder="(11) 99999-9999"
                      maxLength={16}
                      className="w-full bg-black/40 rounded-3xl px-6 py-5 text-lg outline-none transition-colors pr-12"
                      style={{
                        border: whatsappDirty
                          ? whatsappOk
                            ? "1px solid rgba(34,197,94,0.6)"
                            : "1px solid rgba(240,25,107,0.6)"
                          : "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                    {whatsappDirty && (
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg">
                        {whatsappOk ? "✅" : "❌"}
                      </span>
                    )}
                  </div>
                  {whatsappDirty && !whatsappOk && (
                    <p className="text-xs pl-2" style={{ color: "#f0196b" }}>
                      Formato: (XX) 9XXXX-XXXX — somente celular
                    </p>
                  )}
                </div>
              </div>

              {/* Nome do homenageado — destaque especial */}
              <div className="mt-5 rounded-2xl p-5" style={{ background: "rgba(240,25,107,0.06)", border: "1px solid rgba(240,25,107,0.2)" }}>
                <label className="text-sm font-semibold flex items-center gap-2 mb-1" style={{ color: "#f0196b" }}>
                  🎵 Para quem é essa música?
                </label>
                <p className="text-xs text-white/40 mb-3">Nome de quem vai receber a homenagem</p>
                <input
                  value={honoreeName}
                  onChange={(e) => setHonoreeName(e.target.value)}
                  placeholder="Ex: Maria, Vovó Lúcia, Papai…"
                  className="w-full rounded-2xl px-5 py-3.5 text-base outline-none transition-colors"
                  style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(240,25,107,0.3)" }}
                />
              </div>

              <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-5 text-sm text-gray-200 leading-relaxed">
                🔒 Seus dados são privados e usados exclusivamente para entrega da sua música.
              </div>
            </div>
          )}

          {/* ===== STEP 5 — Resumo ===== */}
          {!showLeadCapture && step === 5 && (
            <div>
              <div className="mb-5">
                <h1 className="text-xl font-bold tracking-tight">Confira o resumo antes de finalizar</h1>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-pink-500/10 border border-pink-500/20 rounded-2xl p-5">
                  <p className="text-xs text-pink-400 font-medium mb-1 uppercase tracking-wider">Ocasião</p>
                  <p className="font-semibold">{selectedSubcategory}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <p className="text-xs text-gray-200 font-medium mb-1 uppercase tracking-wider">Estilo</p>
                  <p className="font-semibold">{musicalStyle}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <p className="text-xs text-gray-200 font-medium mb-1 uppercase tracking-wider">Emoção</p>
                  <p className="font-semibold">{emotion}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <p className="text-xs text-gray-200 font-medium mb-1 uppercase tracking-wider">Voz</p>
                  <p className="font-semibold">{voiceType}</p>
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

            </div>
            </div>

            {/* Erro */}
            {!showLeadCapture && error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl p-4 text-sm">
                ⚠️ {error}
              </div>
            )}

            {/* Botões de navegação — desktop */}
            {!showLeadCapture && (
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
            )}

          </div>
        </div>

        {/* Botão fixo no rodapé — mobile */}
        {!showLeadCapture && step !== 1 && step !== 2 && (
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

        <div className="hidden lg:block">
          <Footer />
        </div>

      </div>
    </div>
  )
}
