"use client"

import { useEffect, useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"

type MusicData = {
  mp3_url: string | null
  lyrics: string | null
  music_name: string | null
  person_name: string | null
  slug: string | null
}

export default function MusicaForm({
  orderId,
  honoreeName,
  nome,
}: {
  orderId: string
  honoreeName: string | null
  nome: string
}) {
  const [open, setOpen]             = useState(false)
  const [music, setMusic]           = useState<MusicData | null>(null)
  const [musicName, setMusicName]   = useState("")
  const [personName, setPersonName] = useState(honoreeName ?? nome)
  const [lyrics, setLyrics]         = useState("")
  const [mp3Url, setMp3Url]         = useState("")
  const [uploading, setUploading]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [delivering, setDelivering]   = useState(false)
  const [publicUrl, setPublicUrl]     = useState<string | null>(null)
  const [msg, setMsg]                 = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""

  async function load() {
    const res = await fetch(`/api/admin/producao/${orderId}`)
    const d   = await res.json()
    if (d.music) {
      setMusic(d.music)
      setMusicName(d.music.music_name ?? "")
      setPersonName(d.music.person_name ?? honoreeName ?? nome)
      setLyrics(d.music.lyrics ?? "")
      setMp3Url(d.music.mp3_url ?? "")
      if (d.music.slug) setPublicUrl(`${baseUrl}/m/${d.music.slug}`)
    }
  }

  useEffect(() => { if (open) load() }, [open])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMsg("")

    const fd = new FormData()
    fd.append("file", file)

    const res  = await fetch(`/api/admin/producao/${orderId}/upload`, { method: "POST", body: fd })
    const data = await res.json()

    if (data.url) {
      setMp3Url(data.url)
      setMsg("✅ Upload concluído!")
    } else {
      setMsg(`❌ Erro: ${data.error}`)
    }
    setUploading(false)
  }

  async function handleSave() {
    setSaving(true)
    setMsg("")

    const res = await fetch(`/api/admin/producao/${orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mp3Url, lyrics, musicName, personName }),
    })
    const data = await res.json()

    if (data.music) {
      setMusic(data.music)
      setMsg(mp3Url ? "✅ Salvo!" : "✅ Salvo!")
    } else {
      setMsg(`❌ Erro: ${data.error}`)
    }
    setSaving(false)
  }

  async function handleEntregar() {
    setDelivering(true)
    setMsg("")

    const res  = await fetch(`/api/admin/producao/${orderId}/entregar`, { method: "POST" })
    const data = await res.json()

    if (data.ok) {
      setPublicUrl(data.publicUrl)
      setMsg("✅ Música entregue! E-mail enviado ao cliente.")
    } else {
      setMsg(`❌ Erro: ${data.error}`)
    }
    setDelivering(false)
  }

  const isReady = !!music?.mp3_url

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      <button
        onClick={() => setOpen(!open)}
        className={`text-sm flex items-center gap-2 transition-colors ${
          isReady ? "text-green-400 hover:text-green-300" : "text-gray-400 hover:text-pink-400"
        }`}
      >
        <span>{isReady ? "✅" : "🎵"}</span>
        {isReady ? "Música entregue — ver detalhes" : "Produzir música"}
        <span className="text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* Nome da música */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Título da música</label>
              <input
                value={musicName}
                onChange={(e) => setMusicName(e.target.value)}
                placeholder="Ex: Para Sempre Juntos"
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nome do homenageado</label>
              <input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Ex: Ana"
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>
          </div>

          {/* Letra */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Letra da música</label>
            <textarea
              rows={6}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Cole a letra aqui…"
              className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500 resize-none"
            />
          </div>

          {/* MP3 */}
          <div className="bg-black/30 border border-white/10 rounded-xl p-4">
            <label className="text-xs text-gray-500 mb-2 block">Arquivo MP3</label>

            {mp3Url ? (
              <div className="space-y-2">
                <audio controls src={mp3Url} className="w-full h-10" />
                <p className="text-xs text-gray-500 break-all">{mp3Url}</p>
                <button
                  onClick={() => { setMp3Url(""); if (fileRef.current) fileRef.current.value = "" }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remover arquivo
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="url"
                  value={mp3Url}
                  onChange={(e) => setMp3Url(e.target.value)}
                  placeholder="Cole uma URL de MP3 ou faça upload abaixo"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500"
                />
                <div className="flex items-center gap-3">
                  <label className={`cursor-pointer text-xs px-3 py-2 rounded-lg border transition-colors ${
                    uploading
                      ? "border-white/5 text-gray-600 cursor-not-allowed"
                      : "border-pink-500/30 text-pink-400 hover:bg-pink-500/10"
                  }`}>
                    {uploading ? "Enviando…" : "📁 Selecionar MP3"}
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".mp3,audio/mpeg"
                      onChange={handleUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                  {uploading && (
                    <span className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Feedback */}
          {msg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${
              msg.startsWith("✅") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
            }`}>
              {msg}
            </p>
          )}

          {/* Salvar */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando…
                </>
              ) : "Salvar"}
            </button>

            {mp3Url && (
              <button
                onClick={handleEntregar}
                disabled={delivering}
                className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                {delivering ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando…
                  </>
                ) : "📨 Entregar ao cliente"}
              </button>
            )}
          </div>

          {/* URL pública + QR Code */}
          {publicUrl && (
            <div className="bg-black/30 border border-green-500/20 rounded-xl p-4 space-y-3">
              <p className="text-xs text-green-400 font-medium">✅ URL pública gerada</p>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline break-all block"
              >
                {publicUrl}
              </a>
              <div className="flex justify-center bg-white p-3 rounded-lg">
                <QRCodeSVG value={publicUrl} size={120} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
