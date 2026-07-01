"use client"

import { useEffect, useState } from "react"
import { fmtDateTimeBR } from "@/lib/date"

type SunoMode = "auto" | "review" | "manual"
type Settings = { photos_days: number; lead_days: number; enabled: boolean; music_enabled: boolean; music_days: number; suno_mode?: SunoMode; updatedAt?: string }

const MODES: { id: SunoMode; emoji: string; title: string; desc: string; color: string }[] = [
  { id: "auto",   emoji: "🟢", title: "Totalmente automático", desc: "A IA cria e libera direto pro cliente. Você não toca em nada.", color: "green" },
  { id: "review", emoji: "🟡", title: "Com sua aprovação",      desc: "A IA cria, mas espera você ouvir e liberar antes do cliente.", color: "yellow" },
  { id: "manual", emoji: "🔴", title: "Manual",                 desc: "Nada é gerado sozinho. Você gera ou sobe a música na Produção.", color: "red" },
]
type Log = { ran_at: string; photos_purged: number; leads_purged: number; music_purged?: number; recovery_sent: number; errors: string | null }
type Music = { code: string; orderId: string; url: string; views: number; publishedAt: string | null; daysLeft: number | null }

export default function OperacaoPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [logs, setLogs]         = useState<Log[]>([])
  const [totals, setTotals]     = useState({ photos: 0, leads: 0 })
  const [pending, setPending]   = useState({ photos: 0, leads: 0 })
  const [musics, setMusics]     = useState<Music[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [savedMsg, setSavedMsg] = useState("")
  const [copied, setCopied]     = useState("")

  async function load() {
    const d = await fetch("/api/admin/operacao/purge", { cache: "no-store" }).then((r) => r.json())
    setSettings(d.settings)
    setLogs(d.logs ?? [])
    setTotals(d.totals ?? { photos: 0, leads: 0 })
    setPending(d.pending ?? { photos: 0, leads: 0 })
    setMusics(d.musics ?? [])
    setLoading(false)
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(""), 1500)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setSavedMsg("")
    const res = await fetch("/api/admin/operacao/purge", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    if (res.ok) { setSavedMsg("✅ Salvo"); load() }
    else setSavedMsg("❌ Erro ao salvar")
  }

  // Status de saúde: última execução < 48h e sem erro = ok
  const lastRun = logs[0]
  const lastRunMs = lastRun ? Date.now() - new Date(lastRun.ran_at).getTime() : Infinity
  const healthy = lastRun && lastRunMs < 48 * 3600 * 1000 && !lastRun.errors
  const healthLabel = !lastRun ? "Nunca executou"
    : lastRun.errors ? "Erro na última execução"
    : lastRunMs >= 48 * 3600 * 1000 ? "Sem execução há mais de 48h"
    : "Funcionando"

  if (loading) return (
    <div className="p-8"><div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" /></div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Operação</h1>
      <p className="text-gray-500 text-sm mb-8">Modo de produção da música, expurgo (LGPD) e recuperação de carrinho</p>

      {/* Modo de produção da música */}
      {settings && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-8">
          <h2 className="font-semibold mb-1">🎛️ Modo de produção da música</h2>
          <p className="text-gray-500 text-sm mb-4">Define quanto você participa depois que o cliente aprova a letra. Para o cliente, os três são iguais.</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {MODES.map((m) => {
              const active = (settings.suno_mode ?? "review") === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setSettings({ ...settings, suno_mode: m.id })}
                  className={`text-left rounded-xl border-2 p-4 transition-all ${
                    active ? "border-pink-500 bg-pink-500/10" : "border-white/10 bg-black/30 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{m.emoji}</span>
                    <span className="font-semibold text-sm">{m.title}</span>
                    {active && <span className="ml-auto text-pink-400 text-xs font-bold">● ativo</span>}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{m.desc}</p>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={save}
              disabled={saving}
              className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              {saving ? "Salvando…" : "Salvar modo"}
            </button>
            {savedMsg && <span className="text-sm text-gray-400">{savedMsg}</span>}
          </div>
        </div>
      )}

      {/* Status de saúde */}
      <div className={`rounded-2xl p-5 mb-6 border flex items-center gap-4 ${
        healthy ? "border-green-500/30 bg-green-500/5" : "border-yellow-500/30 bg-yellow-500/5"
      }`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
          healthy ? "bg-green-500/15" : "bg-yellow-500/15"
        }`}>{healthy ? "✅" : "⚠️"}</div>
        <div>
          <p className={`font-semibold ${healthy ? "text-green-300" : "text-yellow-300"}`}>{healthLabel}</p>
          <p className="text-gray-500 text-sm">
            {lastRun ? `Última execução: ${fmtDateTimeBR(lastRun.ran_at)}` : "O expurgo roda 1x/dia junto do cron de recuperação."}
          </p>
        </div>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Fotos expurgadas (30 dias)" value={totals.photos} color="text-pink-400" />
        <StatCard label="Cadastros expurgados (30 dias)" value={totals.leads} color="text-fuchsia-400" />
        <StatCard label="Fotos aguardando expurgo" value={pending.photos} color="text-yellow-400" />
        <StatCard label="Cadastros aguardando expurgo" value={pending.leads} color="text-orange-400" />
      </div>

      {/* Configuração */}
      {settings && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-8">
          <h2 className="font-semibold mb-4">Parâmetros de expurgo</h2>

          <label className="flex items-center gap-3 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="w-5 h-5 accent-pink-500"
            />
            <span className="text-sm">Expurgo automático ativo</span>
          </label>

          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Apagar fotos após (dias)</label>
              <input
                type="number" min={1}
                value={settings.photos_days}
                onChange={(e) => setSettings({ ...settings, photos_days: Number(e.target.value) })}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-pink-500"
              />
              <p className="text-xs text-gray-600 mt-1">Fotos de terceiros sem compra — eliminação LGPD.</p>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Apagar cadastro após (dias)</label>
              <input
                type="number" min={1}
                value={settings.lead_days}
                onChange={(e) => setSettings({ ...settings, lead_days: Number(e.target.value) })}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-pink-500"
              />
              <p className="text-xs text-gray-600 mt-1">Lead não convertido — retenção por legítimo interesse.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save} disabled={saving}
              className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              {saving ? "Salvando…" : "Salvar parâmetros"}
            </button>
            {savedMsg && <span className="text-sm text-gray-400">{savedMsg}</span>}
          </div>
        </div>
      )}

      {/* Histórico de execuções */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
        <h2 className="font-semibold mb-4">Histórico de execuções</h2>
        {logs.length === 0 ? (
          <p className="text-gray-600 text-sm">Nenhuma execução registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/10">
                  <th className="text-left py-2 pr-4 font-medium">Data/hora</th>
                  <th className="text-right py-2 px-4 font-medium">Fotos</th>
                  <th className="text-right py-2 px-4 font-medium">Cadastros</th>
                  <th className="text-right py-2 px-4 font-medium">Músicas</th>
                  <th className="text-right py-2 px-4 font-medium">Recuperação</th>
                  <th className="text-left py-2 pl-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2.5 pr-4 text-gray-300">{fmtDateTimeBR(l.ran_at)}</td>
                    <td className="py-2.5 px-4 text-right text-pink-400">{l.photos_purged}</td>
                    <td className="py-2.5 px-4 text-right text-fuchsia-400">{l.leads_purged}</td>
                    <td className="py-2.5 px-4 text-right text-yellow-400">{l.music_purged ?? 0}</td>
                    <td className="py-2.5 px-4 text-right text-gray-400">{l.recovery_sent}</td>
                    <td className="py-2.5 pl-4">
                      {l.errors ? <span className="text-red-400 text-xs" title={l.errors}>⚠️ erro</span> : <span className="text-green-400 text-xs">ok</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Retenção de URLs de música */}
      {settings && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mt-8">
          <h2 className="font-semibold mb-1">URLs das músicas</h2>
          <p className="text-xs text-gray-500 mb-4">Links gerados para os clientes (player público).</p>

          <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/[0.06] p-4 mb-4">
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={settings.music_enabled}
                onChange={(e) => setSettings({ ...settings, music_enabled: e.target.checked })}
                className="w-5 h-5 accent-yellow-500"
              />
              <span className="text-sm">Apagar URLs de música automaticamente após o prazo</span>
            </label>
            {settings.music_enabled && (
              <p className="text-xs text-yellow-300/80 mb-3">
                ⚠️ Atenção: ao expirar, o MP3 e os dados são <strong>apagados em definitivo</strong> e o QR Code impresso no presente <strong>deixa de funcionar</strong>. Use com cuidado.
              </p>
            )}
            <div className="flex items-end gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Prazo após a entrega (dias)</label>
                <input
                  type="number" min={1}
                  value={settings.music_days}
                  disabled={!settings.music_enabled}
                  onChange={(e) => setSettings({ ...settings, music_days: Number(e.target.value) })}
                  className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-pink-500 disabled:opacity-40 w-32"
                />
              </div>
              <button onClick={save} disabled={saving}
                className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 px-5 py-2 rounded-xl text-sm font-semibold transition-colors">
                {saving ? "Salvando…" : "Salvar"}
              </button>
              {savedMsg && <span className="text-sm text-gray-400">{savedMsg}</span>}
            </div>
          </div>

          {musics.length === 0 ? (
            <p className="text-gray-600 text-sm">Nenhuma música publicada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/10">
                    <th className="text-left py-2 pr-4 font-medium">Pedido</th>
                    <th className="text-left py-2 px-4 font-medium">Link</th>
                    <th className="text-right py-2 px-4 font-medium">Views</th>
                    <th className="text-left py-2 px-4 font-medium">Publicada</th>
                    <th className="text-right py-2 pl-4 font-medium">Expira em</th>
                  </tr>
                </thead>
                <tbody>
                  {musics.map((m) => (
                    <tr key={m.orderId} className="border-b border-white/5">
                      <td className="py-2.5 pr-4 font-mono text-pink-300">#{m.code}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate max-w-[260px] inline-block">{m.url}</a>
                          <button onClick={() => copyUrl(m.url)} className="text-xs text-gray-500 hover:text-white shrink-0">{copied === m.url ? "✓" : "copiar"}</button>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right text-gray-300">{m.views}</td>
                      <td className="py-2.5 px-4 text-gray-500">{m.publishedAt ? fmtDateTimeBR(m.publishedAt) : "—"}</td>
                      <td className="py-2.5 pl-4 text-right">
                        {m.daysLeft == null
                          ? <span className="text-green-400 text-xs">permanente</span>
                          : <span className={m.daysLeft <= 7 ? "text-red-400" : "text-gray-300"}>{m.daysLeft} dia{m.daysLeft !== 1 ? "s" : ""}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1 leading-tight">{label}</p>
    </div>
  )
}
