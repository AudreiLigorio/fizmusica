"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import type { TiktokConnectionStatus } from "@/lib/content/publishers/tiktok-auth"

type Draft = {
  id: string
  platform: string
  status: string
  source_type: string
  sourceOrderId: string | null
  topic: string | null
  hook_text: string | null
  caption: string | null
  hashtags: string | null
  image_url: string | null
  image_task_id: string | null
  image_error: string | null
  rejection_reason: string | null
  video_url: string | null
  published_at: string | null
  published_permalink: string | null
  publish_error: string | null
  created_at: string
  emocao_alvo: string | null
  persona: string | null
  quality_score: number | null
  quality_report: Parecer | null
  needs_human: boolean | null
  link_slug: string | null
  generation_error: string | null
  media_purged_at: string | null
}

type OrigemReal = { nome: string; honoreeName: string | null; consent: boolean; fotos: number }
type Trilha = { orderId: string; label: string }

const VOZES = [
  { id: "Kore", label: "Kore — feminina, firme" },
  { id: "Aoede", label: "Aoede — feminina, suave" },
  { id: "Charon", label: "Charon — masculina, grave" },
  { id: "Puck", label: "Puck — masculina, leve" },
]

type ParecerItem = { pergunta: string; ok: boolean; observacao: string }
type Parecer = { aprovado: boolean; nota: number; itens: ParecerItem[]; correcoes: string }

type VideoScene = { description: string; caption: string }
type VideoJob = {
  id: string
  status: string
  video_url: string | null
  error: string | null
}

const JOB_STATUS_LABEL: Record<string, string> = {
  gerando_ingredientes: "Gerando imagens e música…",
  pronto_pra_renderizar: "Ingredientes prontos — aguardando o worker renderizar (rode `npm run worker:video`)",
  renderizando: "Worker renderizando o vídeo…",
  concluido: "Vídeo pronto!",
  falhou: "Falhou",
}

const JOB_TERMINAL = new Set(["concluido", "falhou"])

// Visualizador em tela cheia. A miniatura de 112px não deixa julgar imagem
// nem vídeo — e é justamente isso que o admin precisa fazer antes de aprovar.
// Fecha no ESC, no clique fora e no botão; a mídia nunca passa da tela.
function Lightbox({ src, tipo, onClose }: { src: string; tipo: "imagem" | "video"; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  return (
    <div onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(4px)" }}>
      <button onClick={onClose} aria-label="Fechar"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white text-xl leading-none hover:bg-white/20">
        ×
      </button>
      <div onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full">
        {tipo === "video"
          ? <video src={src} controls autoPlay playsInline className="max-w-full rounded-xl" style={{ maxHeight: "88vh" }} />
          : <img src={src} alt="" className="max-w-full rounded-xl object-contain" style={{ maxHeight: "88vh" }} />}
        <a href={src} target="_blank" rel="noreferrer"
          className="block text-center text-white/50 text-[11px] mt-3 underline hover:text-white/80">
          abrir em nova aba
        </a>
      </div>
    </div>
  )
}

// Alerta de peça feita a partir de gente de verdade. Precisa gritar: aqui não
// se trata de conteúdo genérico, e sim da história (e possivelmente das fotos)
// de um cliente e de quem ele homenageou. O consentimento é conferido AGORA —
// pode ter sido revogado depois que a peça foi gerada.
function AlertaClienteReal({ origem }: { origem: OrigemReal }) {
  const revogado = !origem.consent

  return (
    <div className={`mb-3 rounded-lg border-2 p-3 ${
      revogado ? "border-red-500 bg-red-500/15" : "border-amber-400/70 bg-amber-400/10"}`}>
      <p className={`text-sm font-bold ${revogado ? "text-red-300" : "text-amber-200"}`}>
        {revogado
          ? "⛔ CONSENTIMENTO REVOGADO — NÃO PUBLICAR"
          : "⚠️ PESSOA REAL — história de cliente nesta peça"}
      </p>
      <p className="text-white/70 text-[11px] mt-1 leading-relaxed">
        Cliente: <strong className="text-white/90">{origem.nome}</strong>
        {origem.honoreeName && <> · homenageado(a): <strong className="text-white/90">{origem.honoreeName}</strong></>}
        {origem.fotos > 0 && <> · {origem.fotos} foto(s) no pedido — <strong className="text-emerald-300">nunca usadas na peça</strong></>}
      </p>
      <p className={`text-[11px] mt-1.5 ${revogado ? "text-red-200" : "text-white/50"}`}>
        {revogado
          ? "O cliente retirou a Autorização de Publicação. Publicar agora usaria dados de uma pessoa sem autorização — rejeite esta peça."
          : "As imagens da peça são criadas por nós — foto de cliente é proibida em divulgação e o sistema bloqueia. O que você precisa conferir é o TEXTO: nada que a família não queira ver publicado, e nenhum dado que identifique quem encomendou (nome, cidade, profissão, data)."}
      </p>
    </div>
  )
}

type JobResumo = { id: string; status: string; error: string | null; video_url: string | null }

// Estado do vídeo visível NO CARD, sem precisar abrir o formulário. Um F5
// fecha o formulário; sem isto, o card ficava mudo e parecia que o trabalho
// tinha sumido — quando na verdade o job estava vivo, esperando o worker.
function VideoStatusBar({ job, onAbrir }: { job: JobResumo; onAbrir: () => void }) {
  const esperandoWorker = job.status === "pronto_pra_renderizar"
  const rodando = !JOB_TERMINAL.has(job.status)

  if (job.status === "concluido") return null

  return (
    <div className={`mt-3 rounded-lg border p-2.5 ${
      job.status === "falhou" ? "border-red-500/30 bg-red-500/5" : "border-fuchsia-500/30 bg-fuchsia-500/5"}`}>
      <p className="text-xs flex items-center gap-2 text-white/80">
        {rodando && <span className="w-3 h-3 border-2 border-fuchsia-400 border-t-transparent rounded-full animate-spin shrink-0" />}
        🎬 {JOB_STATUS_LABEL[job.status] ?? job.status}
      </p>
      {esperandoWorker && (
        <p className="text-amber-200/80 text-[11px] mt-1.5">
          Nada se perdeu: as imagens e a música já estão prontas. Falta só montar o vídeo na sua
          máquina — rode <code className="bg-black/40 px-1 rounded">npm run worker:video</code> no
          terminal do projeto e ele pega este job sozinho.
        </p>
      )}
      {job.error && <p className="text-red-300 text-[11px] mt-1">{job.error}</p>}
      <button onClick={onAbrir} className="text-[11px] text-white/50 underline hover:text-white/80 mt-1.5">
        ver a receita que você escreveu
      </button>
    </div>
  )
}

// Parecer do revisor crítico (segunda passada do roteirista). Mostra a nota e
// só detalha o que FALHOU — item aprovado não precisa ocupar espaço na tela.
function ParecerBox({ parecer }: { parecer: Parecer }) {
  const [aberto, setAberto] = useState(false)
  const falhas = (parecer.itens ?? []).filter((i) => !i.ok)
  const cor = parecer.aprovado ? "emerald" : "amber"

  return (
    <div className={`rounded-lg border p-2.5 ${parecer.aprovado ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
      <button onClick={() => setAberto((v) => !v)} className="w-full flex items-center justify-between text-left">
        <span className={`text-[11px] font-semibold text-${cor}-300`}>
          {parecer.aprovado ? "✅ Aprovado no crivo" : "⚠️ Reprovado no crivo — revise antes de gerar"}
          <span className="text-white/50 font-normal"> · nota {parecer.nota}/10</span>
        </span>
        <span className="text-white/40 text-[11px]">{aberto ? "ocultar" : "ver parecer"}</span>
      </button>

      {!parecer.aprovado && parecer.correcoes && (
        <p className="text-amber-200/80 text-[11px] mt-1.5">{parecer.correcoes}</p>
      )}

      {aberto && (
        <ul className="mt-2 space-y-1">
          {(falhas.length ? falhas : parecer.itens ?? []).map((i, idx) => (
            <li key={idx} className="text-[11px] text-white/60">
              {i.ok ? "✔" : "✘"} <span className="text-white/80">{i.pergunta}</span> — {i.observacao}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Formulário de criação de vídeo — N cenas (descrição + legenda) + tema/estilo
// da música. O Next.js só gera os ingredientes (imagens KIE + música Suno); a
// montagem final roda no worker local (ffmpeg não roda no Vercel).
function VideoForm({ draft, trilhas, onDone }: { draft: Draft; trilhas: Trilha[]; onDone: () => void }) {
  const draftId = draft.id
  const [scenes, setScenes] = useState<VideoScene[]>([
    { description: "", caption: "" },
    { description: "", caption: "" },
    { description: "", caption: "" },
  ])
  const [songTheme, setSongTheme] = useState("")
  const [songStyle, setSongStyle] = useState("pop acústico emotivo, violão e piano, cordas suaves")
  const [job, setJob] = useState<VideoJob | null>(null)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState("")
  // Peça de pedido real pode usar a MÚSICA que o cliente recebeu, em vez de
  // gerar uma nova: é a canção que existiu de verdade, e o worker corta no
  // refrão sozinho (detecta a janela mais alta da faixa).
  const [songSource, setSongSource] = useState<"suno" | "pedido" | "narracao">(draft.sourceOrderId ? "pedido" : "suno")
  const [songOrderId, setSongOrderId] = useState(draft.sourceOrderId ?? trilhas[0]?.orderId ?? "")
  const [narracaoTexto, setNarracaoTexto] = useState("")
  const [narracaoVoz, setNarracaoVoz] = useState("Kore")
  const [narracaoFundo, setNarracaoFundo] = useState<"nenhum" | "pedido" | "suno">("nenhum")
  const [previa, setPrevia] = useState<{ url: string; segundos: number } | null>(null)
  const [ouvindo, setOuvindo] = useState(false)

  // Prévia da narração: gera o áudio e mede a duração ANTES de renderizar. É o
  // que evita descobrir no vídeo pronto que o texto não cabia.
  async function ouvirPrevia() {
    if (!narracaoTexto.trim()) { setMsg("❌ Escreva o texto da narração."); return }
    setOuvindo(true); setMsg("")
    try {
      const res = await fetch("/api/admin/conteudo/narracao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: narracaoTexto, voz: narracaoVoz }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setMsg(`❌ ${d.error ?? "Falha na prévia."}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      await new Promise<void>((resolve) => {
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true })
        audio.addEventListener("error", () => resolve(), { once: true })
      })
      if (previa?.url) URL.revokeObjectURL(previa.url)
      setPrevia({ url, segundos: Number.isFinite(audio.duration) ? audio.duration : 0 })
      audio.play().catch(() => { /* autoplay bloqueado: o player abaixo resolve */ })
    } catch {
      setMsg("❌ Falha ao gerar a prévia.")
    } finally {
      setOuvindo(false)
    }
  }
  const [roteirizando, setRoteirizando] = useState(false)
  const [roteiro, setRoteiro] = useState<{ persona: string; emocao: string; historia: string } | null>(null)
  const [parecer, setParecer] = useState<Parecer | null>(null)

  // Roteirista: preenche a receita inteira (cenas + música) em vez de o admin
  // escrever cada cena na mão. Já vem com a segunda passada crítica aplicada —
  // o parecer aparece na tela pra decidir se aceita ou ajusta antes de gerar.
  async function roteirizar() {
    setRoteirizando(true); setMsg(""); setParecer(null)
    try {
      const res = await fetch("/api/admin/conteudo/roteiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: draft.platform,
          sourceType: draft.source_type,
          topic: draft.topic,
          sourceOrderId: draft.sourceOrderId,
        }),
      })
      const d = await res.json()
      if (!d.ok) { setMsg(`❌ ${d.error}`); return }
      setScenes(d.roteiro.cenas)
      setSongTheme(d.roteiro.songTheme)
      setSongStyle(d.roteiro.songStyle)
      setRoteiro({ persona: d.roteiro.persona, emocao: d.roteiro.emocao, historia: d.roteiro.historia })
      setParecer(d.parecer)
    } catch {
      setMsg("❌ Falha ao gerar o roteiro.")
    } finally {
      setRoteirizando(false)
    }
  }

  // Ao (re)montar, pergunta ao servidor se já existe job pra este rascunho.
  // Sem isto, sair da tela e voltar mostrava o formulário em branco como se
  // nada estivesse rodando — o job continuava vivo no banco, invisível.
  useEffect(() => {
    let cancelado = false
    fetch(`/api/admin/conteudo/${draftId}/video`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelado || !d.job) return
        setJob(d.job)
        // Repõe no formulário o que o admin tinha escrito: a receita fica
        // salva no job, então nada do texto dele se perde num F5.
        const r = d.job.recipe
        if (r?.scenes?.length) {
          setScenes(r.scenes)
          setSongTheme(r.songTheme ?? "")
          setSongStyle(r.songStyle ?? "")
        }
      })
      .catch(() => { /* sem job, formulário limpo mesmo */ })
    return () => { cancelado = true }
  }, [draftId])

  useEffect(() => {
    if (!job || JOB_TERMINAL.has(job.status)) return
    const tick = async () => {
      try {
        const d = await fetch(`/api/admin/conteudo/${draftId}/video`).then((r) => r.json())
        if (d.job) setJob(d.job)
        if (d.job?.status === "concluido") onDone()
      } catch { /* ignora, tenta de novo */ }
    }
    const t = setInterval(tick, 10000)
    return () => clearInterval(t)
  }, [job, draftId, onDone])

  function updateScene(i: number, field: keyof VideoScene, value: string) {
    setScenes((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)))
  }
  function addScene() {
    if (scenes.length >= 6) return
    setScenes((prev) => [...prev, { description: "", caption: "" }])
  }
  function removeScene(i: number) {
    if (scenes.length <= 3) return
    setScenes((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function criar() {
    if (scenes.some((s) => !s.description.trim() || !s.caption.trim())) {
      setMsg("❌ Preencha descrição e legenda de todas as cenas."); return
    }
    if ((songSource === "suno" || (songSource === "narracao" && narracaoFundo === "suno")) && !songTheme.trim()) { setMsg("❌ Informe o tema da música."); return }
    if (songSource === "narracao" && !narracaoTexto.trim()) { setMsg("❌ Escreva o texto da narração."); return }
    if (songSource === "pedido" && !songOrderId) { setMsg("❌ Escolha de qual música vem a trilha."); return }
    setCreating(true); setMsg("")
    const res = await fetch(`/api/admin/conteudo/${draftId}/video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenes, songTheme, songStyle, songSource, platform: draft.platform,
        songOrderId: songSource === "pedido" ? songOrderId : undefined,
        narracaoTexto: songSource === "narracao" ? narracaoTexto : undefined,
        narracaoVoz: songSource === "narracao" ? narracaoVoz : undefined,
        narracaoFundo: songSource === "narracao" ? narracaoFundo : undefined,
      }),
    })
    const d = await res.json()
    setCreating(false)
    if (d.ok) setJob(d.job)
    else setMsg(`❌ ${d.error}`)
  }

  if (job) {
    return (
      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="text-white/70 text-xs flex items-center gap-2">
          {!JOB_TERMINAL.has(job.status) && (
            <span className="w-3 h-3 border-2 border-fuchsia-400 border-t-transparent rounded-full animate-spin" />
          )}
          {JOB_STATUS_LABEL[job.status] ?? job.status}
        </p>
        {job.error && <p className="text-red-400 text-xs mt-1">{job.error}</p>}
        {job.video_url && (
          <video controls className="w-full max-w-xs rounded-lg mt-2" src={job.video_url} />
        )}
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={roteirizar} disabled={roteirizando || creating}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #7c3aed, #d946ef)" }}>
          {roteirizando ? "Roteirizando…" : "✨ Gerar roteiro com IA"}
        </button>
        <span className="text-white/40 text-[11px]">preenche cenas e música — você ajusta antes de gerar</span>
      </div>

      {roteiro && (
        <div className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/5 p-2.5 space-y-1">
          <p className="text-[11px] text-white/70">
            <span className="text-fuchsia-300">Emoção-alvo:</span> {roteiro.emocao} ·{" "}
            <span className="text-fuchsia-300">Persona:</span> {roteiro.persona}
          </p>
          <p className="text-[11px] text-white/60 italic">"{roteiro.historia}"</p>
        </div>
      )}

      {parecer && <ParecerBox parecer={parecer} />}

      <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 space-y-2">
        <p className="text-white/60 text-[11px]">🎧 Trilha do vídeo</p>

        <label className="text-[11px] text-white/70 flex items-start gap-2">
          <input type="radio" checked={songSource === "suno"} onChange={() => setSongSource("suno")} className="mt-0.5" />
          <span><strong className="text-white/85">Criar uma música nova</strong> — você descreve tema e estilo</span>
        </label>

        <label className="text-[11px] text-white/70 flex items-start gap-2">
          <input type="radio" checked={songSource === "pedido"} onChange={() => setSongSource("pedido")}
            disabled={!trilhas.length} className="mt-0.5" />
          <span>
            <strong className="text-fuchsia-300">Usar uma música real já criada</strong> — trecho do refrão, escolhido
            sozinho pelo ponto mais forte da faixa. Não gasta geração.
            {!trilhas.length && <em className="text-white/40"> (nenhuma música com consentimento ainda)</em>}
          </span>
        </label>
        {songSource === "pedido" && trilhas.length > 0 && (
          <select value={songOrderId} onChange={(e) => setSongOrderId(e.target.value)}
            className="w-full bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white ml-5">
            {trilhas.map((t) => <option key={t.orderId} value={t.orderId}>{t.label}</option>)}
          </select>
        )}

        <label className="text-[11px] text-white/70 flex items-start gap-2">
          <input type="radio" checked={songSource === "narracao"} onChange={() => setSongSource("narracao")} className="mt-0.5" />
          <span><strong className="text-white/85">Narração</strong> — uma voz lê o texto que você escrever</span>
        </label>
        {songSource === "narracao" && (
          <div className="ml-5 space-y-1.5">
            <textarea value={narracaoTexto} onChange={(e) => setNarracaoTexto(e.target.value)} rows={3}
              placeholder="Texto que a voz vai narrar. Escreva como fala, não como texto escrito — frases curtas, sem jargão."
              className="w-full bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white" />
            <select value={narracaoVoz} onChange={(e) => setNarracaoVoz(e.target.value)}
              className="bg-black/40 border border-white/15 rounded-lg px-2 py-1 text-[11px] text-white">
              {VOZES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={ouvirPrevia} disabled={ouvindo || creating}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-fuchsia-500/40 text-fuchsia-200 hover:bg-fuchsia-500/10 disabled:opacity-50">
                {ouvindo ? "gerando…" : "🔊 ouvir prévia"}
              </button>
              {previa && (
                <>
                  <audio src={previa.url} controls className="h-7" style={{ maxWidth: 220 }} />
                  {previa.segundos > 0 && (() => {
                    const alvo = duracaoDoVideo(scenes.length)
                    const sobra = alvo - previa.segundos
                    return (
                      <span className={`text-[11px] ${sobra < 0 ? "text-red-300" : sobra < 1.5 ? "text-amber-300" : "text-emerald-300"}`}>
                        {previa.segundos.toFixed(1)}s de narração · vídeo terá {alvo.toFixed(1)}s
                        {sobra < 0
                          ? ` — vai cortar ${Math.abs(sobra).toFixed(1)}s: encurte o texto ou adicione cena`
                          : sobra < 1.5 ? " — no limite" : " — cabe"}
                      </span>
                    )
                  })()}
                </>
              )}
            </div>

            <div className="pt-1">
              <p className="text-white/50 text-[11px] mb-1">Música de fundo sob a voz</p>
              <select value={narracaoFundo} onChange={(e) => setNarracaoFundo(e.target.value as typeof narracaoFundo)}
                className="bg-black/40 border border-white/15 rounded-lg px-2 py-1 text-[11px] text-white">
                <option value="nenhum">Sem música — só a voz</option>
                <option value="pedido" disabled={!trilhas.length}>Uma música já criada</option>
                <option value="suno">Uma música nova (descreva abaixo)</option>
              </select>
              {narracaoFundo === "pedido" && trilhas.length > 0 && (
                <select value={songOrderId} onChange={(e) => setSongOrderId(e.target.value)}
                  className="w-full mt-1.5 bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white">
                  {trilhas.map((t) => <option key={t.orderId} value={t.orderId}>{t.label}</option>)}
                </select>
              )}
              <p className="text-white/35 text-[11px] mt-1">
                A música abaixa sozinha enquanto a voz fala e volta a subir nos silêncios.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-2 gap-2 ${songSource === "suno" || (songSource === "narracao" && narracaoFundo === "suno") ? "" : "hidden"}`}>
        <input value={songTheme} onChange={(e) => setSongTheme(e.target.value)}
          placeholder="Tema da música (ex.: chá revelação, expectativa de bebê)"
          className="bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white" />
        <input value={songStyle} onChange={(e) => setSongStyle(e.target.value)}
          placeholder="Estilo/gênero"
          className="bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white" />
      </div>

      {scenes.map((s, i) => (
        <div key={i} className="border border-white/10 rounded-lg p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-[11px]">Cena {i + 1}</span>
            {scenes.length > 3 && (
              <button onClick={() => removeScene(i)} className="text-white/40 text-[11px] hover:text-red-400">remover</button>
            )}
          </div>
          <textarea value={s.description} onChange={(e) => updateScene(i, "description", e.target.value)}
            placeholder="Descrição visual da cena (ex.: casal grávido sorrindo, mão na barriga, luz dourada)"
            rows={2}
            className="w-full bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white" />
          <input value={s.caption} onChange={(e) => updateScene(i, "caption", e.target.value)}
            placeholder="Legenda dessa cena (texto que aparece no vídeo)"
            className="w-full bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white" />
        </div>
      ))}

      <div className="flex items-center gap-2">
        {scenes.length < 6 && (
          <button onClick={addScene} className="text-[11px] px-2 py-1 rounded-lg border border-white/15 text-white/60 hover:bg-white/5">
            + adicionar cena
          </button>
        )}
        <button onClick={criar} disabled={creating}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50 ml-auto"
          style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
          {creating ? "Criando…" : "🎬 Gerar vídeo"}
        </button>
      </div>
      {msg && <p className="text-red-400 text-xs">{msg}</p>}
    </div>
  )
}

type EligibleOrder = { id: string; nome: string; subcategory: string }

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
]

// Card de um rascunho — sincroniza a geração de imagem a cada 8s enquanto ela
// não tem image_url nem image_error (mesmo padrão de polling do SunoPanel).
// Link rastreado do rascunho: é o que vai pra bio (Instagram/TikTok) ou pra
// descrição (YouTube). Sem ele não existe atribuição — post bom e post ruim
// ficam indistinguíveis.
function LinkRastreado({ slug, cliques }: { slug: string; cliques: number }) {
  const [copiado, setCopiado] = useState(false)
  const url = `https://www.fizmusica.com.br/r/${slug}`

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* navegador sem clipboard: o texto está visível pra copiar na mão */ }
  }

  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px]">
      <span className="text-white/40">🔗</span>
      <code className="text-white/70 bg-black/40 border border-white/10 rounded px-1.5 py-0.5">
        fizmusica.com.br/r/{slug}
      </code>
      <button onClick={copiar} className="px-2 py-0.5 rounded border border-white/15 text-white/60 hover:bg-white/5">
        {copiado ? "copiado ✓" : "copiar"}
      </button>
      <span className={cliques > 0 ? "text-emerald-300" : "text-white/40"}>
        {cliques} {cliques === 1 ? "clique" : "cliques"}
      </span>
    </div>
  )
}

function DraftCard({ draft, cliques, origem, job, trilhas, onChange }: { draft: Draft; cliques: number; origem?: OrigemReal; job?: JobResumo; trilhas: Trilha[]; onChange: () => void }) {
  const [busy, setBusy] = useState<"aprovar" | "rejeitar" | "sincronizar" | "publicar" | "regerar" | "apagar_midia" | "editar" | null>(null)
  const [msg, setMsg] = useState("")
  const [rejeitando, setRejeitando] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showVideoForm, setShowVideoForm] = useState(false)
  const [lightbox, setLightbox] = useState<{ src: string; tipo: "imagem" | "video" } | null>(null)
  const [editando, setEditando] = useState(false)
  const [captionEdit, setCaptionEdit] = useState(draft.caption ?? "")
  const [hashtagsEdit, setHashtagsEdit] = useState(draft.hashtags ?? "")
  const gerando = draft.status === "gerando"
  const pending = !draft.image_url && !draft.image_error && draft.status === "rascunho"

  // Rascunho em geração: pergunta o estado a cada 5s até virar rascunho ou
  // falhar. É o que faz o card se resolver sozinho mesmo se o admin sair da
  // tela e voltar — a geração roda no servidor, não no navegador.
  useEffect(() => {
    if (!gerando) return
    const t = setInterval(async () => {
      try {
        const d = await fetch(`/api/admin/conteudo/${draft.id}`).then((r) => r.json())
        if (d.status && d.status !== "gerando") onChange()
      } catch { /* ignora, tenta de novo */ }
    }, 5000)
    return () => clearInterval(t)
  }, [gerando, draft.id, onChange])

  useEffect(() => {
    if (!pending) return
    const tick = async () => {
      try {
        const d = await fetch(`/api/admin/conteudo/${draft.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sincronizar" }),
        }).then((r) => r.json())
        if (d.draft?.image_url || d.draft?.image_error) onChange()
      } catch { /* ignora, tenta de novo no próximo tick */ }
    }
    const t = setInterval(tick, 8000)
    return () => clearInterval(t)
  }, [pending, draft.id, onChange])

  // Corrigir texto sem jogar a peça fora. Erro de legenda não deveria custar
  // uma imagem, uma música e um render inteiro.
  async function salvarTexto() {
    setBusy("editar"); setMsg("")
    const res = await fetch(`/api/admin/conteudo/${draft.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "editar", caption: captionEdit, hashtags: hashtagsEdit }),
    })
    const d = await res.json()
    setBusy(null)
    if (d.ok) { setEditando(false); onChange() }
    else setMsg(`❌ ${d.error}`)
  }

  async function regerar() {
    setBusy("regerar"); setMsg("")
    const res = await fetch(`/api/admin/conteudo/${draft.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regerar" }),
    })
    const d = await res.json()
    setBusy(null)
    if (d.ok) onChange()
    else setMsg(`❌ ${d.error}`)
  }

  async function apagarMidia() {
    if (!confirm("Apagar a imagem e o vídeo deste rascunho? Os textos e o registro da publicação continuam.")) return
    setBusy("apagar_midia"); setMsg("")
    const res = await fetch(`/api/admin/conteudo/${draft.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apagar_midia" }),
    })
    const d = await res.json()
    setBusy(null)
    if (d.ok) onChange()
    else setMsg(`❌ ${d.error}`)
  }

  async function acao(action: "aprovar" | "rejeitar" | "publicar", reason?: string) {
    // Peça com gente de verdade não passa por clique distraído.
    if (origem && (action === "aprovar" || action === "publicar")) {
      if (!origem.consent) {
        setMsg("⛔ Consentimento revogado — esta peça não pode ser publicada.")
        return
      }
      const quem = origem.honoreeName ? `${origem.nome} (homenagem a ${origem.honoreeName})` : origem.nome
      if (!confirm(`Esta peça usa a história real de ${quem}.\n\nVocê conferiu que o conteúdo está adequado e que a Autorização de Publicação cobre este uso?`)) return
    }
    setBusy(action); setMsg("")
    try {
      const res = await fetch(`/api/admin/conteudo/${draft.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason: reason }),
      })
      const d = await res.json().catch(() => ({ error: "resposta inválida do servidor" }))
      if (d.ok) onChange()
      else setMsg(`❌ ${d.error ?? "falhou"}`)
    } catch {
      // Sem isto, uma queda de rede deixava o botão girando pra sempre e o
      // admin sem saber se publicou ou não.
      setMsg("❌ A conexão caiu no meio. Recarregue e confira se a peça foi publicada antes de tentar de novo.")
    } finally {
      setBusy(null)
    }
  }

  const canPublish = draft.status === "aprovado" && draft.platform === "instagram" && !draft.published_at

  return (
    <div className={`bg-black/30 border rounded-lg p-4 flex gap-4 ${
      origem ? (origem.consent ? "border-amber-400/40" : "border-red-500/60") : "border-white/10"}`}>
      <div className="w-28 h-28 shrink-0 rounded-lg bg-white/5 overflow-hidden flex items-center justify-center">
        {draft.image_url
          ? <img src={draft.image_url} alt="" onClick={() => setLightbox({ src: draft.image_url!, tipo: "imagem" })}
              className="w-full h-full object-cover cursor-zoom-in hover:opacity-80 transition-opacity" />
          : draft.media_purged_at
            ? <span className="text-white/25 text-[10px] text-center px-1 leading-tight">mídia<br />apagada</span>
            : draft.image_error
            ? <span className="text-red-400 text-2xl">⚠️</span>
            : <span className="w-5 h-5 border-2 border-fuchsia-400 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/15 text-white/60 capitalize">
            {draft.platform}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/15 text-white/60">
            {draft.source_type === "pedido" ? "pedido real" : "tema genérico"}
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
            draft.status === "aprovado" ? "border-green-500/30 text-green-400"
              : draft.status === "rejeitado" ? "border-red-500/30 text-red-400"
              : "border-white/15 text-white/60"
          }`}>
            {draft.status}
          </span>
        </div>

        {origem && <AlertaClienteReal origem={origem} />}

        {gerando && (
          <p className="text-fuchsia-300 text-xs mb-1.5 flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-fuchsia-400 border-t-transparent rounded-full animate-spin" />
            Roteirizando e revisando… pode fechar a tela, isso roda no servidor.
          </p>
        )}

        {draft.status === "falhou" && (
          <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2.5">
            <p className="text-red-300 text-xs">A geração falhou: {draft.generation_error ?? "motivo não registrado"}</p>
            <button onClick={regerar} disabled={busy !== null}
              className="mt-2 text-[11px] px-2.5 py-1 rounded-lg border border-white/15 text-white/70 hover:bg-white/5 disabled:opacity-50">
              {busy === "regerar" ? "Regerando…" : "🔄 Tentar de novo"}
            </button>
          </div>
        )}

        {(draft.emocao_alvo || draft.persona) && (
          <p className="text-[11px] text-white/50 mb-1.5">
            🎯 {draft.emocao_alvo ?? "—"}
            {draft.persona && <> · 👤 {draft.persona}</>}
            {draft.quality_score != null && <> · nota {draft.quality_score}/10</>}
            {draft.needs_human && <span className="text-amber-300"> · ⚠️ reprovado no crivo, precisa de você</span>}
          </p>
        )}

        {draft.hook_text && (
          <p className="text-white font-bold text-sm mb-1.5">
            💬 "{draft.hook_text}" <span className="text-white/40 font-normal text-[11px]">(gancho na imagem final)</span>
          </p>
        )}

        {draft.quality_report && <div className="mb-2"><ParecerBox parecer={draft.quality_report} /></div>}
        {editando ? (
          <div className="mb-2 space-y-1.5">
            <textarea value={captionEdit} onChange={(e) => setCaptionEdit(e.target.value)} rows={3}
              className="w-full bg-black/40 border border-fuchsia-500/40 rounded-lg px-2 py-1.5 text-sm text-white" />
            <input value={hashtagsEdit} onChange={(e) => setHashtagsEdit(e.target.value)}
              placeholder="hashtags"
              className="w-full bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-fuchsia-300/80" />
            <div className="flex gap-2 items-center">
              <button onClick={salvarTexto} disabled={busy !== null}
                className="text-[11px] font-semibold px-3 py-1 rounded-lg text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
                {busy === "editar" ? "salvando…" : "salvar texto"}
              </button>
              <button onClick={() => { setEditando(false); setCaptionEdit(draft.caption ?? ""); setHashtagsEdit(draft.hashtags ?? "") }}
                className="text-[11px] px-2 py-1 rounded-lg border border-white/15 text-white/60 hover:bg-white/5">
                cancelar
              </button>
              <span className="text-white/35 text-[11px]">
                o gancho está dentro da imagem — mudá-lo exigiria gerar a imagem de novo
              </span>
            </div>
          </div>
        ) : (
          <>
            <p className="text-white/80 text-sm mb-1 whitespace-pre-wrap">{draft.caption ?? "—"}</p>
            {draft.hashtags && <p className="text-fuchsia-300/70 text-xs mb-1">{draft.hashtags}</p>}
            {!draft.published_at && draft.status !== "gerando" && (
              <button onClick={() => setEditando(true)}
                className="text-[11px] text-white/40 hover:text-fuchsia-300 mb-2">
                ✏️ editar legenda
              </button>
            )}
          </>
        )}
        {draft.image_error && <p className="text-red-400 text-xs mb-2">Imagem: {draft.image_error}</p>}
        {draft.rejection_reason && <p className="text-white/40 text-xs mb-2">Motivo da rejeição: {draft.rejection_reason}</p>}

        {draft.status === "rascunho" && !rejeitando && (
          <div className="flex gap-2">
            <button onClick={() => acao("aprovar")} disabled={busy !== null}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
              {busy === "aprovar" ? "…" : "✅ Aprovar"}
            </button>
            <button onClick={() => setRejeitando(true)} disabled={busy !== null}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/15 text-white/60 hover:bg-white/5 disabled:opacity-50">
              Rejeitar
            </button>
          </div>
        )}

        {draft.status === "rascunho" && rejeitando && (
          <div className="flex gap-2">
            <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Motivo da rejeição (opcional)"
              className="flex-1 bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white" />
            <button onClick={() => acao("rejeitar", rejectionReason)} disabled={busy !== null}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50">
              {busy === "rejeitar" ? "…" : "Confirmar"}
            </button>
            <button onClick={() => setRejeitando(false)} disabled={busy !== null}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/15 text-white/60 hover:bg-white/5 disabled:opacity-50">
              Cancelar
            </button>
          </div>
        )}
        {msg && <p className="text-red-400 text-xs mt-2">{msg}</p>}

        {draft.published_at ? (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-fuchsia-500/30 text-fuchsia-300">
              📤 Publicado no Instagram
            </span>
            {draft.published_permalink && (
              <a href={draft.published_permalink} target="_blank" rel="noreferrer"
                className="text-[11px] text-fuchsia-300 underline hover:text-fuchsia-200">
                ver post ↗
              </a>
            )}
          </div>
        ) : canPublish ? (
          <div className="mt-3">
            <button onClick={() => acao("publicar")} disabled={busy !== null}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
              {busy === "publicar" ? "Publicando…" : "📤 Publicar no Instagram"}
            </button>
            {draft.publish_error && <p className="text-red-400 text-xs mt-1">Falha anterior: {draft.publish_error}</p>}
          </div>
        ) : draft.status === "aprovado" && draft.platform !== "instagram" ? (
          <p className="text-white/40 text-[11px] mt-3">
            Publicação automática ainda não disponível para {draft.platform} (só Instagram por enquanto).
          </p>
        ) : null}

        {draft.video_url ? (
          <div className="mt-3">
            <video src={draft.video_url} className="w-full max-w-xs rounded-lg cursor-zoom-in"
              onClick={() => setLightbox({ src: draft.video_url!, tipo: "video" })} muted playsInline />
            <p className="text-white/40 text-[11px] mt-1">clique pra assistir em tela cheia</p>
          </div>
        ) : job && !JOB_TERMINAL.has(job.status) ? (
          <VideoStatusBar job={job} onAbrir={() => setShowVideoForm((v) => !v)} />
        ) : (
          <button onClick={() => setShowVideoForm((v) => !v)}
            className="text-[11px] px-2 py-1 rounded-lg border border-white/15 text-white/60 hover:bg-white/5 mt-3">
            {showVideoForm ? "Fechar" : job?.status === "falhou" ? "🎬 Refazer vídeo" : "🎬 Criar vídeo (multi-cena)"}
          </button>
        )}
        {showVideoForm && !draft.video_url && <VideoForm draft={draft} trilhas={trilhas} onDone={onChange} />}

        {draft.link_slug && <LinkRastreado slug={draft.link_slug} cliques={cliques} />}

        {draft.media_purged_at && !draft.image_url && !draft.video_url && (
          <p className="text-white/35 text-[11px] mt-2">🧹 mídia já descartada — textos preservados</p>
        )}

        {(draft.image_url || draft.video_url) && draft.status !== "gerando" && (
          <button onClick={apagarMidia} disabled={busy !== null}
            className="mt-2 text-[11px] text-white/40 hover:text-red-300 disabled:opacity-50">
            {busy === "apagar_midia" ? "apagando…" : "🗑️ apagar mídia (libera espaço)"}
          </button>
        )}

        {lightbox && <Lightbox src={lightbox.src} tipo={lightbox.tipo} onClose={() => setLightbox(null)} />}
      </div>
    </div>
  )
}

type ContentSettings = {
  modo: "manual" | "semi" | "auto"
  dias_semana: number[]
  plataformas: string[]
  nota_minima_auto: number
  luto_sempre_manual: boolean
  pedido_real_manual: boolean
  teto_semanal: number
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]

// Mesma conta do worker: cada cena dura 5s e o crossfade come 0,6s por emenda.
const duracaoDoVideo = (nCenas: number) => nCenas * 5 - (nCenas - 1) * 0.6

const MODOS: { valor: ContentSettings["modo"]; titulo: string; desc: string }[] = [
  { valor: "manual", titulo: "Manual", desc: "Nada roda sozinho. Você gera, aprova e publica." },
  { valor: "semi", titulo: "Semi-automático", desc: "O CMO produz no cronograma e a peça espera sua aprovação." },
  { valor: "auto", titulo: "Automático", desc: "O CMO produz e publica sozinho, respeitando as travas." },
]

// Parametrização da esteira: é aqui que se decide se você precisa entrar todo
// dia ou não. O cron roda diariamente; quem define se HOJE é dia de produzir
// é este painel — mudar cronograma não exige deploy.
function EsteiraBox({ inicial }: { inicial: ContentSettings }) {
  const [s, setS] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState("")
  const [rodando, setRodando] = useState(false)

  // Dispara a esteira na hora, sem esperar o dia agendado. Útil pra testar o
  // critério do CMO e pra encaixar uma peça fora do cronograma.
  async function rodarAgora() {
    if (!confirm("Rodar a esteira agora? O CMO vai escolher a pauta e gerar uma peça (consome créditos de IA).")) return
    setRodando(true); setMsg("")
    try {
      const d = await fetch("/api/admin/conteudo/esteira", { method: "POST" }).then((r) => r.json())
      if (d.error) setMsg(`❌ ${d.error}`)
      else if (d.pulou) setMsg(`pulou: ${d.pulou}`)
      else { window.location.reload(); return }
    } catch {
      setMsg("❌ falha ao rodar a esteira")
    } finally {
      setRodando(false)
    }
  }

  async function salvar(patch: Partial<ContentSettings>) {
    const novo = { ...s, ...patch }
    setS(novo); setSalvando(true); setMsg("")
    const res = await fetch("/api/admin/conteudo/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    const d = await res.json()
    setSalvando(false)
    if (d.ok) { setS(d.settings); setMsg("salvo ✓"); setTimeout(() => setMsg(""), 2000) }
    else { setMsg(`❌ ${d.error}`); setS(s) }
  }

  function toggleDia(dia: number) {
    const dias = s.dias_semana.includes(dia)
      ? s.dias_semana.filter((d) => d !== dia)
      : [...s.dias_semana, dia].sort()
    salvar({ dias_semana: dias })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/80 text-sm font-semibold">🤖 Esteira de conteúdo</p>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-[11px]">{salvando ? "salvando…" : msg}</span>
          <button onClick={rodarAgora} disabled={rodando}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-white/15 text-white/60 hover:bg-white/5 disabled:opacity-50">
            {rodando ? "rodando…" : "▶️ rodar agora"}
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-2 mb-4">
        {MODOS.map((m) => (
          <button key={m.valor} onClick={() => salvar({ modo: m.valor })}
            className={`text-left rounded-lg border p-2.5 transition-colors ${
              s.modo === m.valor
                ? "border-fuchsia-500/60 bg-fuchsia-500/10"
                : "border-white/10 bg-black/20 hover:bg-white/5"}`}>
            <p className={`text-xs font-semibold ${s.modo === m.valor ? "text-fuchsia-300" : "text-white/70"}`}>
              {m.titulo}
            </p>
            <p className="text-white/45 text-[11px] mt-0.5 leading-snug">{m.desc}</p>
          </button>
        ))}
      </div>

      {s.modo !== "manual" && (
        <>
          <p className="text-white/50 text-[11px] mb-1.5">Dias em que o CMO produz</p>
          <div className="flex gap-1 flex-wrap mb-3">
            {DIAS.map((nome, i) => (
              <button key={i} onClick={() => toggleDia(i)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border ${
                  s.dias_semana.includes(i)
                    ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200"
                    : "border-white/10 text-white/40 hover:bg-white/5"}`}>
                {nome}
              </button>
            ))}
          </div>

          <label className="text-[11px] text-white/50 flex items-center gap-2 mb-3">
            Teto de peças automáticas por semana
            <input type="number" min={1} max={50} value={s.teto_semanal}
              onChange={(e) => salvar({ teto_semanal: Number(e.target.value) })}
              className="w-16 bg-black/40 border border-white/15 rounded px-2 py-1 text-white text-[11px]" />
          </label>
        </>
      )}

      {s.modo === "auto" && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5 space-y-1.5">
          <p className="text-amber-300 text-[11px] font-semibold">Travas da publicação automática</p>
          <label className="text-[11px] text-white/60 flex items-center gap-2">
            Só publica sozinho com nota
            <input type="number" min={0} max={10} step={0.5} value={s.nota_minima_auto}
              onChange={(e) => salvar({ nota_minima_auto: Number(e.target.value) })}
              className="w-14 bg-black/40 border border-white/15 rounded px-2 py-0.5 text-white text-[11px]" />
            ou mais
          </label>
          <label className="text-[11px] text-white/60 flex items-center gap-2">
            <input type="checkbox" checked={s.luto_sempre_manual}
              onChange={(e) => salvar({ luto_sempre_manual: e.target.checked })} />
            Peça de luto/despedida sempre espera aprovação
          </label>
          <label className="text-[11px] text-white/60 flex items-center gap-2">
            <input type="checkbox" checked={s.pedido_real_manual}
              onChange={(e) => salvar({ pedido_real_manual: e.target.checked })} />
            Peça de história real de cliente sempre espera aprovação
          </label>
        </div>
      )}

      <p className="text-white/35 text-[11px] mt-3">
        {s.modo === "manual"
          ? "Hoje nada é produzido sozinho — você precisa entrar e gerar."
          : `O CMO escolhe o tema (calendário + histórico + cliques) e produz ${s.dias_semana.length}× por semana, por volta das 10h.`}
      </p>
    </div>
  )
}

// Login Kit do TikTok — só autenticação (user.info.basic), pra habilitar a
// publicação de verdade é preciso uma segunda aprovação (Content Posting API).
function TiktokConnectBox({ status }: { status: TiktokConnectionStatus }) {
  const params = useSearchParams()
  const result = params.get("tiktok")
  const resultMsg = params.get("tiktok_msg")

  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-black/20 p-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <p className="text-white/80 text-sm font-semibold">TikTok — Login Kit</p>
        {status.connected ? (
          <p className="text-green-400 text-xs mt-0.5">
            ✅ Conectado (open_id {status.openId.slice(0, 8)}…, escopo {status.scope})
          </p>
        ) : (
          <p className="text-white/40 text-xs mt-0.5">Não conectado — necessário pro vídeo demo do App Review.</p>
        )}
        {result === "conectado" && <p className="text-green-400 text-xs mt-1">Conectado com sucesso!</p>}
        {result === "erro" && <p className="text-red-400 text-xs mt-1">Falha ao conectar: {resultMsg ?? "erro desconhecido"}</p>}
      </div>
      <a href="/api/admin/conteudo/tiktok/login"
        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/15 text-white/80 hover:bg-white/5">
        {status.connected ? "🔁 Reconectar" : "🔌 Conectar TikTok"}
      </a>
    </div>
  )
}

export default function ConteudoList({
  initialDrafts,
  eligibleOrders,
  tiktokStatus,
  clicksByDraft,
  settings,
  origens,
  jobPorDraft,
  trilhas,
}: {
  initialDrafts: Draft[]
  eligibleOrders: EligibleOrder[]
  tiktokStatus: TiktokConnectionStatus
  clicksByDraft: Record<string, number>
  settings: ContentSettings
  origens: Record<string, OrigemReal>
  jobPorDraft: Record<string, JobResumo>
  trilhas: Trilha[]
}) {
  const [platform, setPlatform] = useState("instagram")
  const [sourceType, setSourceType] = useState<"generico" | "pedido">("generico")
  const [topic, setTopic] = useState("")
  const [sourceOrderId, setSourceOrderId] = useState(eligibleOrders[0]?.id ?? "")
  const [gerando, setGerando] = useState(false)
  const [msg, setMsg] = useState("")

  function reload() { window.location.reload() }

  async function gerar() {
    setGerando(true); setMsg("")
    const body = sourceType === "generico"
      ? { platform, sourceType, topic }
      : { platform, sourceType, sourceOrderId }
    const res = await fetch("/api/admin/conteudo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const d = await res.json()
    setGerando(false)
    if (d.ok) reload()
    else setMsg(`❌ ${d.error}`)
  }

  return (
    <div>
      <EsteiraBox inicial={settings} />
      <TiktokConnectBox status={tiktokStatus} />

      <div className="mb-6 rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/[0.05] p-4">
        <p className="text-fuchsia-200 font-semibold text-sm mb-3">✨ Gerar novo rascunho</p>

        <div className="flex flex-wrap gap-3 mb-3">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}
            className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white">
            {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          <select value={sourceType} onChange={(e) => setSourceType(e.target.value as "generico" | "pedido")}
            className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white">
            <option value="generico">Tema livre</option>
            <option value="pedido">Pedido real (com consentimento)</option>
          </select>
        </div>

        {sourceType === "generico" ? (
          <input value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex.: dica de presente pra Dia das Mães"
            className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white mb-3" />
        ) : (
          <select value={sourceOrderId} onChange={(e) => setSourceOrderId(e.target.value)}
            className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white mb-3">
            {eligibleOrders.length === 0 && <option value="">Nenhum pedido com consentimento de publicação</option>}
            {eligibleOrders.map((o) => (
              <option key={o.id} value={o.id}>{o.nome} — {o.subcategory}</option>
            ))}
          </select>
        )}

        <button onClick={gerar} disabled={gerando || (sourceType === "pedido" && !sourceOrderId)}
          className="text-xs font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
          {gerando ? "Gerando…" : "Gerar rascunho"}
        </button>
        {msg && <p className="text-red-400 text-xs mt-2">{msg}</p>}
      </div>

      {initialDrafts.length === 0 ? (
        <p className="text-white/40 text-sm">Nenhum rascunho ainda.</p>
      ) : (
        <div className="space-y-3">
          {initialDrafts.map((d) => (
            <DraftCard key={d.id} draft={d} cliques={clicksByDraft[d.id] ?? 0}
              origem={d.sourceOrderId ? origens[d.sourceOrderId] : undefined}
              job={jobPorDraft[d.id]} trilhas={trilhas} onChange={reload} />
          ))}
        </div>
      )}
    </div>
  )
}
