"use client"

import { useEffect, useState } from "react"

type Settings = { prompt: string; model: string; location: string }

const MODELS = [
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
]

export default function CompositorPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState("")

  useEffect(() => {
    fetch("/api/admin/compositor")
      .then((r) => r.json())
      .then((d) => { setSettings(d); setLoading(false) })
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    setMsg("")
    const res = await fetch("/api/admin/compositor", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
    const data = await res.json()
    setSaving(false)
    setMsg(data.ok ? "✅ Salvo!" : `❌ ${data.error}`)
  }

  if (loading) return (
    <div className="p-8"><div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" /></div>
  )

  if (!settings) return null

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Compositor IA</h1>
      <p className="text-gray-500 text-sm mb-8">
        Prompt e modelo do Gemini usados para gerar letras. Alterações valem para as próximas gerações.
      </p>

      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Modelo</label>
            <select
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value })}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500"
            >
              {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              {!MODELS.includes(settings.model) && (
                <option value={settings.model}>{settings.model}</option>
              )}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Localização (Vertex)</label>
            <input
              value={settings.location}
              onChange={(e) => setSettings({ ...settings, location: e.target.value })}
              placeholder="global"
              className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Prompt do compositor</label>
          <textarea
            rows={28}
            value={settings.prompt}
            onChange={(e) => setSettings({ ...settings, prompt: e.target.value })}
            className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-500 resize-y font-mono leading-relaxed"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={save}
            disabled={saving}
            className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white text-sm px-6 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Salvando…
              </>
            ) : "Salvar prompt"}
          </button>
          {msg && (
            <span className={`text-sm ${msg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>
              {msg}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
