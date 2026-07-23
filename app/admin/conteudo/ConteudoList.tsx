"use client"

import { useEffect, useState } from "react"

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
  created_at: string
}

type EligibleOrder = { id: string; nome: string; subcategory: string }

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
]

// Card de um rascunho — sincroniza a geração de imagem a cada 8s enquanto ela
// não tem image_url nem image_error (mesmo padrão de polling do SunoPanel).
function DraftCard({ draft, onChange }: { draft: Draft; onChange: () => void }) {
  const [busy, setBusy] = useState<"aprovar" | "rejeitar" | "sincronizar" | null>(null)
  const [msg, setMsg] = useState("")
  const [rejeitando, setRejeitando] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
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

  async function acao(action: "aprovar" | "rejeitar", reason?: string) {
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

        {draft.hook_text && (
          <p className="text-white font-bold text-sm mb-1.5">
            💬 "{draft.hook_text}" <span className="text-white/40 font-normal text-[11px]">(gancho na imagem final)</span>
          </p>
        )}
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
      </div>
    </div>
  )
}

export default function ConteudoList({
  initialDrafts,
  eligibleOrders,
}: {
  initialDrafts: Draft[]
  eligibleOrders: EligibleOrder[]
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
            <DraftCard key={d.id} draft={d} onChange={reload} />
          ))}
        </div>
      )}
    </div>
  )
}
