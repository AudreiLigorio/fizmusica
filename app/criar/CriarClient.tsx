"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Header from "../components/Header"
import Footer from "../components/Footer"
import MicButton from "../components/MicButton"
import JourneyProgress from "../components/JourneyProgress"
import type { CreateOrderDTO } from "@/app/types/order"
import { DEFAULT_PHOTO_LIMIT } from "@/lib/photoLimit"
import { useScrollTopOnStepChange } from "@/app/hooks/useScrollTopOnStepChange"

// Detecta erros de digitação comuns no domínio do e-mail e sugere correção
const COMMON_EMAIL_DOMAINS = [
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br",
  "icloud.com", "live.com", "bol.com.br", "uol.com.br", "terra.com.br",
]
function levenshtein(a: string, b: string): number {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) m[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return m[a.length][b.length]
}
function suggestEmailTypo(email: string): string | null {
  const match = email.trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/)
  if (!match) return null
  const [, local, domain] = match
  if (COMMON_EMAIL_DOMAINS.includes(domain)) return null
  let fixed = domain.replace(/\.con$/, ".com").replace(/\.cmo$/, ".com").replace(/\.comm$/, ".com")
  if (COMMON_EMAIL_DOMAINS.includes(fixed)) return `${local}@${fixed}`
  const near = COMMON_EMAIL_DOMAINS.find((d) => levenshtein(d, domain) === 1)
  return near ? `${local}@${near}` : null
}

type WizardQuestion    = { id: string; label: string; sort_order: number }
type WizardSubcategory = { id: string; label: string; emoji: string; slug: string; sort_order: number; wizard_questions: WizardQuestion[] }
type WizardOccasion    = { id: string; label: string; emoji: string; slug: string; wizard_subcategories: WizardSubcategory[] }

type SessionData = {
  step: number
  questionStep: number
  tipoMusica: "" | "presente" | "livre"
  selectedContext: string
  selectedSubcategory: string
  answers: Record<string, string>
  musicalStyle: string
  misturarEstilos?: boolean
  voiceType: string
  emotion: string
  nome: string
  email: string
  whatsapp: string
  honoreeName: string
  leadCaptured?: boolean
  orderId?: string
}

import { track } from "@/lib/track"

const SESSION_KEY = "fizmusica_session_id"

function maskWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length === 0) return ""
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

type CriarClientProps = {
  initialOccasions: WizardOccasion[]
  initialLivreDisponivel: boolean
  initialPresenteDisponivel: boolean
}

export default function CriarClient({ initialOccasions, initialLivreDisponivel, initialPresenteDisponivel }: CriarClientProps) {
  return (
    <Suspense fallback={null}>
      <CriarMusicaInner
        initialOccasions={initialOccasions}
        initialLivreDisponivel={initialLivreDisponivel}
        initialPresenteDisponivel={initialPresenteDisponivel}
      />
    </Suspense>
  )
}

function CriarMusicaInner({ initialOccasions, initialLivreDisponivel, initialPresenteDisponivel }: CriarClientProps) {

  const router = useRouter()
  const searchParams = useSearchParams()

  const [occasions, setOccasions] = useState<WizardOccasion[]>(initialOccasions)
  // Se só um dos dois caminhos (presente x livre) tem produto ativo, não há
  // escolha real a fazer no passo 0 — pula direto pro passo 1 já com o tipo
  // certo. Calculado uma vez, no mount: os produtos ativos não mudam durante
  // a sessão do wizard.
  const [singlePathTipo] = useState<"" | "presente" | "livre">(() => {
    if (initialLivreDisponivel && !initialPresenteDisponivel) return "livre"
    if (initialPresenteDisponivel && !initialLivreDisponivel) return "presente"
    return ""
  })
  // Passo 0: pergunta se há destinatário — decide o que faz sentido pedir depois
  // (hoje os dois caminhos convergem pro mesmo passo 1; a resposta fica salva
  // pronta pra quando o restante do fluxo passar a variar por ela).
  const [step, setStep] = useState(singlePathTipo ? 1 : 0)
  const [tipoMusica, setTipoMusica] = useState<"" | "presente" | "livre">(singlePathTipo)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const TERMS_VERSION = "2026-06"
  const [selectedContext, setSelectedContext] = useState("")
  const [selectedSubcategory, setSelectedSubcategory] = useState("")
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [musicalStyle, setMusicalStyle] = useState("")
  // "Misturar estilos" é um modo explícito, não inferido — decidimos assim
  // depois de perceber que 2 chips marcados sem essa pergunta antes deixava
  // ambíguo se a pessoa queria misturar ou só estava comparando opções.
  const [misturarEstilos, setMisturarEstilos] = useState(false)
  // Chip que levou um clique além do limite — dispara o tremor (feedback no
  // gesto) sem esmaecer o resto da grade, que ficaria parecendo tela quebrada
  // com 18 dos 20 estilos apagados de uma vez.
  const [estiloBloqueado, setEstiloBloqueado] = useState<string | null>(null)
  const [voiceType, setVoiceType] = useState("")
  const [emotion, setEmotion] = useState("")
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [honoreeName, setHonoreeName] = useState("")
  const [orderId, setOrderId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [questionStep, setQuestionStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [interimText, setInterimText] = useState("")

  // Step 6 — fotos
  type UploadedPhoto = { id: string; url: string }
  const [photos, setPhotos]           = useState<UploadedPhoto[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError]   = useState("")
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Sincroniza as fotos já salvas assim que o orderId é conhecido (pedido recém
  // criado ou retomado de uma sessão anterior). Sem isso, ao sair da etapa 6 e
  // voltar (ex.: "Voltar" em /produtos), o estado local reinicia vazio mesmo com
  // fotos já existindo no pedido — o cliente reenvia e cria duplicatas.
  useEffect(() => {
    if (!orderId) return
    fetch(`/api/orders/${orderId}/fotos`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.photos) setPhotos(d.photos.map((p: { id: string; url: string }) => ({ id: p.id, url: p.url }))) })
      .catch(() => {})
  }, [orderId])
  const contentRef = useRef<HTMLDivElement>(null)
  useScrollTopOnStepChange(`${step}-${questionStep}`, contentRef)

  // Passo alcançado: é o que revela onde a jornada trava. O wizard já salva a
  // sessão dele (wizard_sessions), mas aquilo é retomada de pedido — isto aqui
  // é o funil, e precisa existir mesmo pra quem abandona antes de digitar nada.
  useEffect(() => {
    track("wizard_passo", `passo-${step}`)
  }, [step])

  // Leva o olhar do usuário até a mensagem de erro assim que ela aparece —
  // sem isso, numa etapa longa o aviso pode renderizar fora da tela.
  const errorRef = useRef<HTMLDivElement>(null)
  const leadErrorRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }) }, [error])

  // Session persistence
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [resumeBanner, setResumeBanner] = useState<SessionData | null>(null)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Marca que o cliente já começou a preencher nesta visita — impede o banner de
  // retomada de aparecer no MEIO do fluxo se o fetch de sessão resolver atrasado.
  const startedRef = useRef(false)

  // Lead capture (após 3ª pergunta respondida)
  const [showLeadCapture, setShowLeadCapture] = useState(false)
  const [leadCaptured, setLeadCaptured] = useState(false)
  const [leadNome, setLeadNome] = useState("")
  const [leadEmail, setLeadEmail] = useState("")
  const [leadWhatsapp, setLeadWhatsapp] = useState("")
  const [leadHonoreeName, setLeadHonoreeName] = useState("")
  const [leadError, setLeadError] = useState("")
  useEffect(() => { if (leadError) leadErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }) }, [leadError])

  const leadWhatsappOk = /^\(\d{2}\) 9\d{4}-\d{4}$/.test(leadWhatsapp)
  const leadWhatsappDirty = leadWhatsapp.length > 0
  const leadEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)
  const leadEmailDirty = leadEmail.length > 0
  const emailSuggestion = leadEmailDirty ? suggestEmailTypo(leadEmail) : null

  // As ocasiões já vêm renderizadas do servidor (SSR + cache). Só busca via API
  // como fallback caso o servidor não tenha conseguido carregá-las.
  useEffect(() => {
    if (initialOccasions.length > 0) return
    fetch("/api/wizard")
      .then((r) => r.json())
      .then((d) => setOccasions(d.occasions ?? []))
  }, [initialOccasions])

  // Ao montar: verifica ?sessao=UUID (link de e-mail de recuperação) ou localStorage
  useEffect(() => {
    // Fluxo e-mail → pagamento → "Voltar": vem com ?orderId. Reconstrói o wizard a
    // partir do PEDIDO (não do localStorage, que some no in-app browser do mobile).
    const urlOrderId = searchParams.get("orderId")
    if (urlOrderId) {
      fetch(`/api/orders/${urlOrderId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          const o = json?.order
          if (!o) return
          // Pedido já pago não deve ser reeditado no wizard — leva pra área do cliente.
          if (o.paymentStatus === "PAID") { router.replace(`/minha-musica?orderId=${urlOrderId}`); return }
          resumeSessionData({
            selectedContext:     o.context ?? "",
            selectedSubcategory: o.subcategory ?? "",
            answers: Object.fromEntries(
              (o.order_answers ?? [])
                .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
                .map((a: { question: string; answer: string }) => [a.question, a.answer])
            ),
            musicalStyle: o.musicalStyle ?? "",
            voiceType:    o.voiceType ?? "",
            emotion:      o.emotion ?? "",
            nome:         o.nome ?? "",
            email:        o.email ?? "",
            whatsapp:     o.whatsapp ?? "",
            honoreeName:  o.honoreeName ?? "",
            leadCaptured: true,
            orderId:      urlOrderId,
          }, 5)
        })
        .catch(() => {})
      return
    }

    const urlSessionId = searchParams.get("sessao")
    const storedId = urlSessionId ?? localStorage.getItem(SESSION_KEY)
    if (!storedId) return

    fetch(`/api/wizard-session?id=${storedId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const s = json?.session
        if (!s || !s.data) return

        // Só pula direto pro resumo quando o cliente clicou em "Voltar" na tela /produtos
        // (fluxo "voltar e atualizar"). Numa visita nova ao wizard, mesmo com orderId
        // salvo, deve cair no banner de retomada (continuar pedido vs. começar novo).
        if (s.data.orderId && searchParams.get("editar") === "1") {
          localStorage.setItem(SESSION_KEY, storedId)
          setSessionId(storedId)
          resumeSessionData(s.data, 5)
          return
        }

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
        // Se o cliente já começou a preencher (fetch lento resolveu tarde), NÃO
        // interrompe com o banner — ele já está numa sessão ativa.
        if (startedRef.current) return
        setResumeBanner({ ...s.data, step: s.step })
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Assim que o cliente avança (escolhe ocasião / responde), trava o banner tardio.
  useEffect(() => {
    if (step > 1 || selectedContext || Object.keys(answers).length > 0) startedRef.current = true
  }, [step, selectedContext, answers])

  /* ================================================= */
  /* SESSION HELPERS                                   */
  /* ================================================= */

  function buildSessionData(overrides: Partial<SessionData> = {}): SessionData {
    return {
      step,
      questionStep,
      tipoMusica,
      selectedContext,
      selectedSubcategory,
      answers,
      musicalStyle,
      misturarEstilos,
      voiceType,
      emotion,
      nome,
      email,
      whatsapp,
      honoreeName,
      leadCaptured,
      orderId: orderId ?? undefined,
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
    setTipoMusica(data.tipoMusica ?? "")
    setSelectedContext(data.selectedContext ?? "")
    setSelectedSubcategory(data.selectedSubcategory ?? "")
    setAnswers(data.answers ?? {})
    setMusicalStyle(data.musicalStyle ?? "")
    // Se a sessão salva já tem 2 estilos (separados por vírgula), a tela
    // volta com o modo "misturar" ligado — senão o retomar mostraria os
    // dois escolhidos, mas o botão diria "um estilo só".
    setMisturarEstilos(data.misturarEstilos ?? (data.musicalStyle ?? "").includes(", "))
    setVoiceType(data.voiceType ?? "")
    setEmotion(data.emotion ?? "")
    setNome(data.nome ?? "")
    setEmail(data.email ?? "")
    setWhatsapp(data.whatsapp ?? "")
    setHonoreeName(data.honoreeName ?? "")
    setLeadCaptured(data.leadCaptured ?? false)
    setOrderId(data.orderId ?? null)
    // orderId só entra na sessão DEPOIS que handleFinalizar cria o pedido, o que
    // exige termsAccepted=true naquele momento — ou seja, se há orderId, os termos
    // já foram aceitos de verdade. Sem isso, o resumo da etapa 5 volta pedindo pra
    // aceitar de novo, mesmo já tendo aceitado (o checkbox nunca era persistido).
    setTermsAccepted(!!data.orderId)
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
    setOrderId(null)
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
    if (tipoMusica !== "livre" && !leadHonoreeName.trim()) { setLeadError("Informe para quem é essa música."); return }

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
    step === 0 ? 0 : ((step - 1 + internalQuestionProgress) / totalSteps) * 100

  // Escolha do passo 0 — avança direto pro passo 1, sem botão "Continuar"
  // separado (mesmo padrão do passo 1, onde escolher a ocasião já avança).
  function escolherTipoMusica(tipo: "presente" | "livre") {
    setTipoMusica(tipo)
    const nextSt = 1
    setStep(nextSt)
    saveSession(buildSessionData({ tipoMusica: tipo, step: nextSt }), nextSt)
  }

  // musicalStyle continua sendo UMA string só (sem campo novo em lugar
  // nenhum do sistema) — "Rock" ou, misturando, "Rock, Reggae". O resumo, o
  // payload do pedido e o prompt pro Suno leem exatamente como sempre leram.
  function clicarEstilo(item: string) {
    const atuais = musicalStyle ? musicalStyle.split(", ") : []
    const idx = atuais.indexOf(item)
    if (idx !== -1) {
      setMusicalStyle(atuais.filter((_, i) => i !== idx).join(", "))
      return
    }
    if (!misturarEstilos) {
      setMusicalStyle(item) // um estilo só: escolher outro troca, não soma
      return
    }
    if (atuais.length >= 2) {
      setEstiloBloqueado(item)
      setTimeout(() => setEstiloBloqueado(null), 220)
      return
    }
    setMusicalStyle([...atuais, item].join(", "))
  }

  function alternarMisturarEstilos(mix: boolean) {
    setMisturarEstilos(mix)
    if (!mix) {
      const atuais = musicalStyle ? musicalStyle.split(", ") : []
      if (atuais.length > 1) setMusicalStyle(atuais[0]) // mantém só o 1º escolhido
    }
  }

  /* ================================================= */
  /* NEXT STEP                                         */
  /* ================================================= */

  function advanceQuestion() {
    setInterimText("")
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
      if (tipoMusica !== "livre" && !honoreeName.trim()) {
        setError("Informe para quem é essa música.")
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
    // Passo 0 é o primeiro — não existe passo -1 pra voltar dentro do wizard,
    // então "Voltar" aqui sai pro início do site.
    if (step === 0) {
      router.push("/")
      return
    }
    // Quando o passo 0 foi pulado (só um caminho tinha produto ativo), não
    // existe uma tela de escolha pra voltar — "Voltar" no passo 1 sai direto
    // pro início do site, igual sairia do próprio passo 0.
    if (step === 1 && singlePathTipo) {
      router.push("/")
      return
    }
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
    if (!termsAccepted) {
      setError("Para continuar, aceite os Termos de Uso e a Política de Privacidade.")
      return
    }
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
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      honoreeConsent: !!honoreeName.trim(),
      answers: questions.map((q, i) => ({
        question: q,
        answer: answers[q] ?? "",
        position: i,
        context: selectedContext,
        subcategory: selectedSubcategory,
      })),
    }

    try {
      const isEditing = !!orderId
      const res = await fetch(
        isEditing ? `/api/orders/${orderId}` : "/api/orders",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )

      const data = await res.json()

      if (!res.ok || (!isEditing && !data.success) || (isEditing && !data.success)) {
        setError(data.error ?? "Erro ao enviar. Tente novamente.")
        setSubmitting(false)
        return
      }

      const finalOrderId = isEditing ? orderId! : data.orderId

      // Salva orderId na sessão (sem debounce, antes de navegar)
      if (!isEditing && sessionId) {
        setOrderId(finalOrderId)
        const updated = buildSessionData({ orderId: finalOrderId, step })
        if (saveTimeout.current) clearTimeout(saveTimeout.current)
        try {
          await fetch("/api/wizard-session", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: sessionId, step, data: updated }),
          })
        } catch {}
      }

      // "Só para mim" não tem fotos — pula o passo 6 e vai direto pro produto.
      // O passo 6 continua existindo só pra quem escolheu "para alguém".
      if (tipoMusica === "livre") {
        router.push(`/produtos?orderId=${finalOrderId}`)
        return
      }

      // Vai para step 6 (fotos) em vez de navegar direto
      setStep(6)
      setSubmitting(false)
    } catch {
      setError("Falha de conexão. Verifique sua internet.")
      setSubmitting(false)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !orderId) return
    if (photos.length >= DEFAULT_PHOTO_LIMIT) { setPhotoError(`Máximo de ${DEFAULT_PHOTO_LIMIT} fotos atingido.`); return }

    setUploadingPhoto(true)
    setPhotoError("")
    const form = new FormData()
    form.append("file", file)
    try {
      const res  = await fetch(`/api/orders/${orderId}/fotos`, { method: "POST", body: form })
      const data = await res.json()
      if (data.photo) setPhotos((p) => [...p, { id: data.photo.id, url: data.photo.url }])
      else setPhotoError(data.error ?? "Erro ao enviar foto.")
    } catch {
      setPhotoError("Falha de conexão.")
    } finally {
      setUploadingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ""
    }
  }

  async function handlePhotoDelete(photoId: string) {
    if (!orderId) return
    setPhotos((p) => p.filter((x) => x.id !== photoId))
    await fetch(`/api/orders/${orderId}/fotos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    }).catch(() => {})
  }

  // Move uma foto uma posição pra frente/trás — mesma mecânica do painel de fotos
  // da área do cliente (app/minha-musica/FotosPanel.tsx).
  async function handlePhotoMove(photoId: string, dir: -1 | 1) {
    if (!orderId) return
    const i = photos.findIndex((p) => p.id === photoId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= photos.length) return
    const reordered = [...photos]
    ;[reordered[i], reordered[j]] = [reordered[j], reordered[i]]
    setPhotos(reordered)
    await fetch(`/api/orders/${orderId}/fotos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder: reordered.map((p) => p.id) }),
    }).catch(() => {})
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

        {/* ── Jornada completa (todas as páginas) ── */}
        <div className="shrink-0 border-b border-white/[0.06] px-4">
          <JourneyProgress current={step <= 5 ? 1 : 2} semFotos={tipoMusica === "livre"} />
        </div>

        {/* ── Mobile: barra de progresso + topo (só steps 1-5) ── */}
        {step <= 5 && (
        <div className="lg:hidden shrink-0">
          <div className="h-[2px] w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-full transition-all duration-500"
                 style={{ width: `${progress}%`, background: "linear-gradient(90deg, #f0196b, #d946ef)" }} />
          </div>
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            {step >= 0 && !showLeadCapture ? (
              <button onClick={prevStep} disabled={submitting}
                      className="text-white/50 text-sm disabled:opacity-30">← Voltar</button>
            ) : <div />}
            <div />
            <div />
          </div>
        </div>
        )}

        {/* ── Mobile: Voltar no topo — step 6 (fotos) ── */}
        {step === 6 && (
        <div className="lg:hidden shrink-0 px-5 pt-4 pb-2">
          <button onClick={prevStep} disabled={submitting}
                  className="text-white/50 text-sm disabled:opacity-30">← Voltar</button>
        </div>
        )}

        {/* ── Área de conteúdo ── */}
        <div ref={contentRef} className="flex-1 overflow-y-auto lg:overflow-visible" style={{ overflowX: "hidden", width: "100%" }}>
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

            <div className={step === 6 ? "" : "wizard-card"}>
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
                  {emailSuggestion && (
                    <button
                      type="button"
                      onClick={() => setLeadEmail(emailSuggestion)}
                      className="text-xs text-yellow-400 hover:text-yellow-300 pl-2 text-left"
                    >
                      Você quis dizer <span className="underline font-medium">{emailSuggestion}</span>? Toque para corrigir.
                    </button>
                  )}
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

                {/* Nome do homenageado — só existe pra quem tem destinatário. Quem
                    respondeu "só para mim" já foi avisado que não teria isso. */}
                {tipoMusica !== "livre" && (
                  <div className="space-y-2 rounded-2xl p-4" style={{ background: "rgba(240,25,107,0.06)", border: "1px solid rgba(240,25,107,0.2)" }}>
                    <label className="text-sm font-semibold pl-1 flex items-center gap-2" style={{ color: "#f0196b" }}>
                      🎵 Para quem é essa música?
                    </label>
                    <p className="text-xs text-white/40 pl-1 -mt-1">Nome de quem vai receber a homenagem</p>
                    <div className="relative">
                      <input
                        value={leadHonoreeName}
                        onChange={(e) => setLeadHonoreeName(e.target.value)}
                        placeholder="Ex: Maria, Vovó Lúcia, Papai…"
                        className="w-full rounded-2xl px-5 py-3.5 text-base outline-none transition-colors"
                        style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(240,25,107,0.3)" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {leadError && (
                <div ref={leadErrorRef} className="mt-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl p-4 text-sm">
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

          {/* ===== STEP 0 — Presente ou pra você ===== */}
          {!showLeadCapture && step === 0 && (
            <div>
              <div className="mb-8">
                <h1 className="text-2xl lg:text-3xl font-bold mb-1 tracking-tight">
                  Essa música é para alguém, ou é para você?
                </h1>
                <p className="text-white/55 text-sm">
                  Isso muda o que vem a seguir — cada caminho tem só o que faz sentido pra ele.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => escolherTipoMusica("presente")}
                  className="w-full text-left rounded-2xl p-5 border transition-all border-pink-500/40 bg-pink-500/5 hover:border-pink-500"
                >
                  <h2 className="text-base font-semibold mb-1 text-pink-500">🎁 Para alguém especial</h2>
                  <p className="text-xs text-white/55">Com fotos e QR code para impressão</p>
                </button>

                <button
                  onClick={() => escolherTipoMusica("livre")}
                  className="w-full text-left rounded-2xl p-5 border transition-all border-purple-500/40 bg-purple-500/5 hover:border-purple-500"
                >
                  <h2 className="text-base font-semibold mb-1 text-purple-400">🎵 Só para mim</h2>
                  <p className="text-xs text-white/55">Só a música — sem fotos, sem QR code</p>
                </button>
              </div>
            </div>
          )}

          {/* ===== STEP 1 — Ocasião ===== */}
          {!showLeadCapture && step === 1 && (
            <div>
              <div className="mb-8">
                <h1 className="text-2xl lg:text-3xl font-bold mb-1 tracking-tight">
                  {tipoMusica === "livre" ? "Como você quer compor?" : "Qual história você quer transformar em música?"}
                </h1>
                <p className="text-white/55 text-sm">
                  {tipoMusica === "livre"
                    ? "Sem destinatário, sem ocasião obrigatória — é a sua música, do jeito que você quiser."
                    : "Você pode criar música para celebrar, homenagear, emocionar, surpreender, se declarar, compor ou só contar uma história para transformar em música."}
                </p>
              </div>

              <div className="space-y-2">
                {occasions.length === 0 ? (
                  [0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="border border-white/10 bg-black/20 rounded-2xl px-4 py-3.5 animate-pulse">
                      <div className="h-4 w-40 bg-white/10 rounded mb-2.5" />
                      <div className="h-2.5 w-56 bg-white/5 rounded" />
                    </div>
                  ))
                ) : (tipoMusica === "livre"
                    ? occasions.filter((o) => o.label === "Composição Livre")
                    : [...occasions].sort((a, b) => Number(b.label === "Composição Livre") - Number(a.label === "Composição Livre"))
                  ).map((occasion) => (
                  <div
                    key={occasion.id}
                    className={`border rounded-2xl overflow-hidden transition-all ${
                      selectedContext === occasion.label
                        ? "border-pink-500 bg-pink-500/5"
                        : occasion.label === "Composição Livre"
                          ? "border-pink-500/40 bg-pink-500/[0.04]"
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
                          occasion.label === "Composição Livre" ? (
                            <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                              Componha a sua música do jeito que quiser, ou escreva uma história para virar música.
                            </p>
                          ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {occasion.wizard_subcategories.slice(0, 4).map((sub, i) => (
                              <span key={sub.id} className="text-[10px]"
                                style={{ color: "rgba(255,255,255,0.55)" }}>
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
                          )
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
                <h1 className="text-xl font-bold tracking-tight">Vamos criar algo inesquecível</h1>
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

                <div className="relative">
                  <textarea
                    rows={4}
                    value={answers[currentQuestion] || ""}
                    onChange={(e) =>
                      setAnswers({ ...answers, [currentQuestion]: e.target.value })
                    }
                    placeholder="Escreva com carinho… cada detalhe faz diferença ❤️"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 pr-14 text-sm outline-none focus:border-pink-500 resize-none transition-colors placeholder:text-white/30"
                  />
                  <div className="absolute bottom-3 right-3">
                    <MicButton
                      onResult={(text) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [currentQuestion]: prev[currentQuestion]
                            ? prev[currentQuestion].trimEnd() + " " + text
                            : text,
                        }))
                      }
                      onInterim={setInterimText}
                    />
                  </div>
                </div>

                {interimText && (
                  <p className="text-xs text-pink-300/70 px-1 mt-1 italic animate-pulse">
                    🎤 {interimText}…
                  </p>
                )}

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
                <div className="flex items-baseline justify-between mb-2">
                  <h2 className="text-[0.65rem] font-semibold uppercase tracking-widest" style={{ color: "#f0196b" }}>Estilo musical</h2>
                  {misturarEstilos && (
                    <span className="text-[11px] text-white/40 tabular-nums">
                      {(musicalStyle ? musicalStyle.split(", ").length : 0)}/2 selecionados
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={() => alternarMisturarEstilos(false)}
                    className={`text-left rounded-xl px-3 py-2.5 border transition-all text-sm ${
                      !misturarEstilos
                        ? "border-pink-500 bg-pink-500/10 text-white"
                        : "border-white/10 bg-black/30 hover:border-pink-500/50 text-gray-300"
                    }`}
                  >
                    <span className="block font-medium">🎯 Um estilo só</span>
                    <span className="block text-[11px] text-white/40">Do jeito de sempre</span>
                  </button>
                  <button
                    onClick={() => alternarMisturarEstilos(true)}
                    className={`text-left rounded-xl px-3 py-2.5 border transition-all text-sm ${
                      misturarEstilos
                        ? "border-pink-500 bg-pink-500/10 text-white"
                        : "border-white/10 bg-black/30 hover:border-pink-500/50 text-gray-300"
                    }`}
                  >
                    <span className="block font-medium">🎨 Misturar dois estilos</span>
                    <span className="block text-[11px] text-white/40">Os dois juntos, não um de cada</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 overflow-hidden">
                  {[
                    "🎤 Sertanejo", "🎶 Pagode",   "💖 Pop",
                    "🎵 Forró",     "🎸 Rock",    "🎹 MPB",
                    "🙏 Gospel",    "🎧 Funk",    "🔥 Trap",
                    "🎙️ Rap",       "💃 Dance",   "🎷 Jazz",
                    "🎉 Axé",       "🤘 Metal",   "🎤 Hip-Hop",
                    "⚡ Heavy Metal","🤠 Country", "🌿 Reggae",
                    "🇰🇷 K-Pop",    "🌎 Internacional",
                    "🌹 R&B",       "🇧🇷 Samba",  "🙌 Gospel Soul",
                  ].map((item) => {
                    const atuais = musicalStyle ? musicalStyle.split(", ") : []
                    const ordem = atuais.indexOf(item)
                    const escolhido = ordem !== -1
                    return (
                      <button
                        key={item}
                        onClick={() => clicarEstilo(item)}
                        className={`min-w-0 w-full rounded-xl px-3 py-2.5 border transition-all text-left text-sm font-medium overflow-hidden ${
                          escolhido
                            ? "border-pink-500 bg-pink-500/10 text-white"
                            : "border-white/10 bg-black/30 hover:border-pink-500/50 text-gray-300"
                        } ${estiloBloqueado === item ? "fm-chip-shake" : ""}`}
                      >
                        {escolhido && misturarEstilos && (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold mr-1.5 align-middle"
                                style={{ background: "#f0196b" }}>
                            {ordem + 1}
                          </span>
                        )}
                        {item}
                      </button>
                    )
                  })}
                </div>

                {misturarEstilos && musicalStyle.includes(", ") && (
                  <div className="mt-3 rounded-xl px-3.5 py-2.5 text-xs text-white/85 flex items-center gap-2"
                       style={{ background: "linear-gradient(135deg, rgba(240,25,107,0.12), rgba(217,70,239,0.12))", border: "1px solid rgba(240,25,107,0.25)" }}>
                    <span>🎶</span>
                    <span>Sua música vai misturar <b className="font-semibold">{musicalStyle}</b></span>
                  </div>
                )}
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
                    "💖 Emocionante",  "❤️ Romântica",
                    "☀️ Alegre",       "🎉 Divertida",
                    "😭 Profunda",     "🙏 Inspiradora",
                    "⚡ Energético",   "😤 Agressivo",
                    "😰 Tenso",        "😌 Calmo",
                    "🌿 Relaxante",    "📼 Nostálgico",
                    "🕯️ Íntimo",      "🌧️ Melancólico",
                    "😢 Triste",
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
                  <div className="relative">
                    <input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="w-full bg-black/40 border border-white/10 rounded-3xl px-6 py-5 text-lg outline-none focus:border-pink-500 transition-colors"
                    />
                  </div>
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

              {tipoMusica !== "livre" && (
                <div className="mt-5 rounded-2xl p-5" style={{ background: "rgba(240,25,107,0.06)", border: "1px solid rgba(240,25,107,0.2)" }}>
                  <label className="text-sm font-semibold flex items-center gap-2 mb-1" style={{ color: "#f0196b" }}>
                    🎵 Para quem é essa música?
                  </label>
                  <p className="text-xs text-white/40 mb-3">Nome de quem vai receber a homenagem</p>
                  <div className="relative">
                    <input
                      value={honoreeName}
                      onChange={(e) => setHonoreeName(e.target.value)}
                      placeholder="Ex: Maria, Vovó Lúcia, Papai…"
                      className="w-full rounded-2xl px-5 py-3.5 text-base outline-none transition-colors"
                      style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(240,25,107,0.3)" }}
                    />
                  </div>
                </div>
              )}

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
                {[
                  { label: "Ocasião", value: selectedSubcategory },
                  { label: "Estilo",  value: musicalStyle },
                  { label: "Emoção",  value: emotion },
                  { label: "Voz",     value: voiceType },
                ].map(({ label, value }) => (
                  <div key={label} className="border border-pink-500/40 bg-pink-500/10 shadow-[0_0_24px_rgba(236,72,153,0.12)] rounded-2xl p-5">
                    <p className="text-xs text-pink-400 font-medium mb-1 uppercase tracking-wider">{label}</p>
                    <p className="font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-black/40 border border-white/10 rounded-[28px] p-8 whitespace-pre-wrap text-gray-300 leading-relaxed text-sm max-h-80 overflow-y-auto mb-6">
                {resumo}
              </div>

            </div>
          )}

            </div>
            </div>

          {/* ===== STEP 6 — Fotos ===== */}
          {step === 6 && (
            <div className="px-5 py-6 pb-32 lg:pb-12 lg:max-w-xl lg:mx-auto">
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold mb-2">Adicione fotos à sua música</h1>
                <p className="text-white/50 text-sm max-w-sm mx-auto">
                  As fotos aparecem no player enquanto a música toca. A quantidade que você pode adicionar varia de acordo com o produto escolhido.
                </p>
              </div>

              {/* Grid de fotos */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {photos.map((photo, i) => (
                  <div key={photo.id} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handlePhotoDelete(photo.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-500/80 transition-colors"
                    >
                      ✕
                    </button>
                    {photos.length > 1 && (
                      <div className="absolute bottom-1.5 inset-x-1.5 flex justify-between">
                        <button
                          onClick={() => handlePhotoMove(photo.id, -1)}
                          disabled={i === 0}
                          className="w-6 h-6 rounded-full bg-black/70 hover:bg-pink-600 text-white text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-black/70"
                          title="Mover para trás"
                        >‹</button>
                        <button
                          onClick={() => handlePhotoMove(photo.id, 1)}
                          disabled={i === photos.length - 1}
                          className="w-6 h-6 rounded-full bg-black/70 hover:bg-pink-600 text-white text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-black/70"
                          title="Mover para frente"
                        >›</button>
                      </div>
                    )}
                  </div>
                ))}

                {photos.length < DEFAULT_PHOTO_LIMIT && (
                  <label className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    uploadingPhoto ? "border-pink-500/30 opacity-50 cursor-not-allowed" : "border-white/15 hover:border-pink-500/40"
                  }`}>
                    {uploadingPhoto ? (
                      <span className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="text-2xl mb-1 text-white/30">+</span>
                        <span className="text-[10px] text-white/30">Adicionar</span>
                      </>
                    )}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {photoError && (
                <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-2 mb-4">{photoError}</p>
              )}

              {photos.length > 0 && (
                <p className="text-xs text-white/30 text-center mb-6">
                  {photos.length} de 5 foto{photos.length > 1 ? "s" : ""} adicionada{photos.length > 1 ? "s" : ""} ✓
                </p>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push(`/produtos?orderId=${orderId}`)}
                  className="w-full py-4 rounded-2xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 4px 24px rgba(240,25,107,0.4)" }}
                >
                  {photos.length > 0 ? "Continuar com as fotos →" : "Continuar sem fotos →"}
                </button>
                {photos.length === 0 && (
                  <button
                    onClick={() => router.push(`/produtos?orderId=${orderId}`)}
                    className="w-full py-3 rounded-2xl text-sm text-white/35 hover:text-white/60 transition-colors"
                  >
                    Pular por agora
                  </button>
                )}
              </div>

              {/* Voltar — desktop, no rodapé (mesmo padrão dos outros steps) */}
              <div className="hidden lg:flex justify-start mt-10">
                <button onClick={prevStep} disabled={submitting}
                        className="transition-all px-7 py-3.5 rounded-2xl text-sm font-medium text-white/60 hover:text-white disabled:opacity-40"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
                  ← Voltar
                </button>
              </div>
            </div>
          )}

            {/* Erro */}
            {!showLeadCapture && step !== 6 && error && (
              <div ref={errorRef} className="mt-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl p-4 text-sm">
                ⚠️ {error}
              </div>
            )}

            {/* Botões de navegação — desktop */}
            {!showLeadCapture && step !== 6 && (
              <>
              {step === 5 && (
                <label className="flex items-start gap-3 mt-8 cursor-pointer max-w-2xl">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-pink-500 shrink-0"
                  />
                  <span className="text-xs text-white/60 leading-relaxed">
                    Li e concordo com os{" "}
                    <a href="/legal/termos-de-uso" className="text-pink-400 underline">Termos de Uso</a>, a{" "}
                    <a href="/legal/politica-de-privacidade" className="text-pink-400 underline">Política de Privacidade</a>, a{" "}
                    <a href="/legal/licenca-de-uso" className="text-pink-400 underline">Licença de Uso da Música</a>{" "}
                    e a{" "}
                    <a href="/legal/reembolso-e-cancelamento" className="text-pink-400 underline">Política de Reembolso</a>, e{" "}
                    <a href="/legal/consentimento" className="text-pink-400 underline">autorizo o tratamento dos meus dados</a>{" "}
                    para a criação da música.
                    {honoreeName.trim() ? (
                      <> Declaro possuir{" "}
                        <a href="/legal/autorizacao-dados-terceiros" className="text-pink-400 underline">autorização para fornecer os dados do homenageado</a>.
                      </>
                    ) : null}
                  </span>
                </label>
              )}

              <div className="hidden lg:flex justify-between items-center mt-10">
                {step >= 0 ? (
                  <button onClick={prevStep} disabled={submitting}
                          className="transition-all px-7 py-3.5 rounded-2xl text-sm font-medium text-white/60 hover:text-white disabled:opacity-40"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
                    ← Voltar
                  </button>
                ) : <div />}
                {step > 1 && step < 5 && (
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
              </>
            )}

          </div>
        </div>

        {/* Botão fixo no rodapé — mobile */}
        {!showLeadCapture && step !== 0 && step !== 1 && step !== 2 && step !== 6 && (
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
