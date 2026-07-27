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
}

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
function VideoForm({ draft, onDone }: { draft: Draft; onDone: () => void }) {
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
    if (!songTheme.trim()) { setMsg("❌ Informe o tema da música."); return }
    setCreating(true); setMsg("")
    const res = await fetch(`/api/admin/conteudo/${draftId}/video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenes, songTheme, songStyle }),
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

      <div className="grid grid-cols-2 gap-2">
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

function DraftCard({ draft, cliques, onChange }: { draft: Draft; cliques: number; onChange: () => void }) {
  const [busy, setBusy] = useState<"aprovar" | "rejeitar" | "sincronizar" | "publicar" | null>(null)
  const [msg, setMsg] = useState("")
  const [rejeitando, setRejeitando] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showVideoForm, setShowVideoForm] = useState(false)
  const pending = !draft.image_url && !draft.image_error && draft.status === "rascunho"

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

  async function acao(action: "aprovar" | "rejeitar" | "publicar", reason?: string) {
    setBusy(action); setMsg("")
    const res = await fetch(`/api/admin/conteudo/${draft.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, rejectionReason: reason }),
    })
    const d = await res.json()
    setBusy(null)
    if (d.ok) onChange()
    else setMsg(`❌ ${d.error}`)
  }

  const canPublish = draft.status === "aprovado" && draft.platform === "instagram" && !draft.published_at

  return (
    <div className="bg-black/30 border border-white/10 rounded-lg p-4 flex gap-4">
      <div className="w-28 h-28 shrink-0 rounded-lg bg-white/5 overflow-hidden flex items-center justify-center">
        {draft.image_url
          ? <img src={draft.image_url} alt="" className="w-full h-full object-cover" />
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
        <p className="text-white/80 text-sm mb-1 whitespace-pre-wrap">{draft.caption ?? "—"}</p>
        {draft.hashtags && <p className="text-fuchsia-300/70 text-xs mb-2">{draft.hashtags}</p>}
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
          <video controls className="w-full max-w-xs rounded-lg mt-3" src={draft.video_url} />
        ) : (
          <button onClick={() => setShowVideoForm((v) => !v)}
            className="text-[11px] px-2 py-1 rounded-lg border border-white/15 text-white/60 hover:bg-white/5 mt-3">
            {showVideoForm ? "Fechar" : "🎬 Criar vídeo (multi-cena)"}
          </button>
        )}
        {showVideoForm && !draft.video_url && <VideoForm draft={draft} onDone={onChange} />}

        {draft.link_slug && <LinkRastreado slug={draft.link_slug} cliques={cliques} />}
      </div>
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
}: {
  initialDrafts: Draft[]
  eligibleOrders: EligibleOrder[]
  tiktokStatus: TiktokConnectionStatus
  clicksByDraft: Record<string, number>
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
            <DraftCard key={d.id} draft={d} cliques={clicksByDraft[d.id] ?? 0} onChange={reload} />
          ))}
        </div>
      )}
    </div>
  )
}
