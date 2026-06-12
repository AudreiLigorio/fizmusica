"use client"

import { useEffect, useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"

type MusicData = {
  mp3Url: string | null
  imageUrl: string | null
  lyrics: string | null
  musicName: string | null
  personName: string | null
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
  const [lyricsLrc, setLyricsLrc]   = useState("")
  const [mp3Url, setMp3Url]         = useState("")
  const [imageUrl, setImageUrl]     = useState("")
  const [uploading, setUploading]     = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [delivering, setDelivering]   = useState(false)
  const [publicUrl, setPublicUrl]     = useState<string | null>(null)
  const [msg, setMsg]                 = useState("")
  const [tapping, setTapping]         = useState(false)
  const [tapIndex, setTapIndex]       = useState(0)
  const [tapTimes, setTapTimes]       = useState<number[]>([])
  const fileRef   = useRef<HTMLInputElement>(null)
  const imgRef    = useRef<HTMLInputElement>(null)
  const audioRef  = useRef<HTMLAudioElement>(null)
  const tapAudio  = useRef<HTMLAudioElement>(null)
  const baseUrl   = typeof window !== "undefined" ? window.location.origin : ""

  // linhas reais da letra (sem marcadores de seção)
  const tapLines = lyrics.split("\n").map((l) => l.trim()).filter((l) => l && !/^\[.*\]$/.test(l))

  function startTap() {
    if (!mp3Url) { setMsg("❌ Anexe o MP3 antes de sincronizar."); return }
    if (tapLines.length === 0) { setMsg("❌ Preencha a letra antes de sincronizar."); return }
    setTapIndex(0)
    setTapTimes([])
    setTapping(true)
    setTimeout(() => tapAudio.current?.play(), 100)
  }

  function handleTap() {
    const t = tapAudio.current?.currentTime ?? 0
    const newTimes = [...tapTimes, t]
    setTapTimes(newTimes)
    const nextIndex = tapIndex + 1
    if (nextIndex >= tapLines.length) {
      finalizeTap(newTimes)
    } else {
      setTapIndex(nextIndex)
    }
  }

  function finalizeTap(times: number[]) {
    tapAudio.current?.pause()
    const lrc = tapLines.map((linha, i) => {
      const t  = times[i] ?? 0
      const mm = Math.floor(t / 60).toString().padStart(2, "0")
      const ss = Math.floor(t % 60).toString().padStart(2, "0")
      const cs = Math.floor((t % 1) * 100).toString().padStart(2, "0")
      return `[${mm}:${ss}.${cs}]${linha}`
    }).join("\n")
    setLyricsLrc(lrc)
    setTapping(false)
    setMsg("✅ LRC sincronizado! Clique em Salvar.")
  }

  function cancelTap() {
    tapAudio.current?.pause()
    setTapping(false)
  }

  function gerarLrc() {
    const linhas = lyrics.split("\n").map((l) => l.trim()).filter(Boolean)
    if (linhas.length === 0) { setMsg("❌ Preencha a letra antes de gerar o LRC."); return }
    const duracao = audioRef.current?.duration
    if (!duracao || isNaN(duracao)) { setMsg("❌ Aguarde o áudio carregar para gerar o LRC."); return }

    // Distribui timestamps uniformemente, com 80% do tempo (reserva silêncio final)
    const intervalo = (duracao * 0.85) / linhas.length
    const lrc = linhas.map((linha, i) => {
      const t = i * intervalo
      const mm = Math.floor(t / 60).toString().padStart(2, "0")
      const ss = Math.floor(t % 60).toString().padStart(2, "0")
      const cs = Math.floor((t % 1) * 100).toString().padStart(2, "0")
      return `[${mm}:${ss}.${cs}]${linha}`
    }).join("\n")

    setLyricsLrc(lrc)
    setMsg("✅ LRC gerado! Revise os timestamps e clique em Salvar.")
  }

  async function load() {
    const res = await fetch(`/api/admin/producao/${orderId}`)
    const d   = await res.json()
    if (d.music) {
      setMusic(d.music)
      setMusicName(d.music.musicName ?? "")
      setPersonName(d.music.personName ?? honoreeName ?? nome)
      setLyrics(d.music.lyrics ?? "")
      setLyricsLrc(d.music.lyricsLrc ?? "")
      setMp3Url(d.music.mp3Url ?? "")
      setImageUrl(d.music.imageUrl ?? "")
      if (d.music.slug) setPublicUrl(`${baseUrl}/m/${d.music.slug}`)
    }
  }

  useEffect(() => { if (open) load() }, [open])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMsg("")

    try {
      // 1. Pede URL assinada ao servidor (usa service_role, ignora RLS)
      const res = await fetch(`/api/admin/producao/${orderId}/upload-url`, { method: "POST" })
      const { signedUrl, publicUrl, error: urlError } = await res.json()
      if (urlError) throw new Error(urlError)

      // 2. Faz upload direto para o Supabase usando a URL assinada
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "audio/mpeg" },
      })
      if (!uploadRes.ok) throw new Error(`Upload falhou: ${uploadRes.status}`)

      setMp3Url(publicUrl)
      setMsg("✅ Upload concluído! Clique em Salvar para confirmar.")
    } catch (err: any) {
      setMsg(`❌ Erro: ${err.message ?? "Falha no upload"}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImg(true)
    setMsg("")

    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
      const res = await fetch(`/api/admin/producao/${orderId}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ext }),
      })
      const { signedUrl, publicUrl, error: urlError } = await res.json()
      if (urlError) throw new Error(urlError)

      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      })
      if (!uploadRes.ok) throw new Error(`Upload falhou: ${uploadRes.status}`)

      setImageUrl(publicUrl)
      setMsg("✅ Imagem enviada! Clique em Salvar para confirmar.")
    } catch (err: any) {
      setMsg(`❌ Erro: ${err.message ?? "Falha no upload da imagem"}`)
    } finally {
      setUploadingImg(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setMsg("")

    const res = await fetch(`/api/admin/producao/${orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mp3Url, imageUrl, lyrics, lyricsLrc, musicName, personName }),
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
      if (data.emailSent === false) {
        setMsg(`✅ Música entregue! ⚠️ E-mail falhou: ${data.emailError ?? "erro desconhecido"}`)
      } else {
        setMsg("✅ Música entregue! E-mail enviado ao cliente.")
      }
    } else {
      setMsg(`❌ Erro: ${data.error}`)
    }
    setDelivering(false)
  }

  const isReady = !!music?.mp3Url

  return (
    <>
    {/* AUDIO oculto para o tap */}
    <audio ref={tapAudio} src={mp3Url || undefined} preload="auto" />

    {/* MODAL TIME-TAP */}
    {tapping && (
      <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6">
        <p className="text-gray-400 text-xs mb-2 tracking-widest uppercase">
          Linha {tapIndex + 1} de {tapLines.length}
        </p>

        {/* Linha anterior */}
        {tapIndex > 0 && (
          <p className="text-gray-600 text-sm mb-4 italic">
            {tapLines[tapIndex - 1]}
          </p>
        )}

        {/* Linha atual */}
        <p className="text-white text-2xl font-bold text-center mb-2 max-w-xl leading-snug">
          {tapLines[tapIndex]}
        </p>

        {/* Próxima linha */}
        {tapIndex + 1 < tapLines.length && (
          <p className="text-gray-500 text-sm mt-2 mb-8">
            A seguir: {tapLines[tapIndex + 1]}
          </p>
        )}
        {tapIndex + 1 >= tapLines.length && (
          <p className="text-yellow-400 text-sm mt-2 mb-8">Última linha!</p>
        )}

        {/* Botão TAP */}
        <button
          onClick={handleTap}
          className="w-48 h-48 rounded-full bg-pink-500 hover:bg-pink-400 active:scale-95 active:bg-pink-600 transition-all flex flex-col items-center justify-center shadow-2xl shadow-pink-500/40 select-none"
        >
          <span className="text-4xl mb-1">🥁</span>
          <span className="text-white font-bold text-lg">TAP</span>
          <span className="text-pink-200 text-xs mt-1">clique quando esta linha começar</span>
        </button>

        {/* Barra de progresso da sessão */}
        <div className="mt-8 w-full max-w-xs bg-white/10 rounded-full h-1.5">
          <div
            className="bg-pink-500 h-1.5 rounded-full transition-all"
            style={{ width: `${(tapIndex / tapLines.length) * 100}%` }}
          />
        </div>

        <button
          onClick={cancelTap}
          className="mt-6 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancelar
        </button>
      </div>
    )}

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

          {/* Letra LRC com timestamps */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Letra com timestamps (LRC) —{" "}
              <span className="text-gray-600">sincronização perfeita com a música</span>
            </label>
            <p className="text-xs text-gray-600 mb-2">
              Formato: <code className="bg-white/5 px-1 rounded">[mm:ss.xx]Linha da letra</code>
              {" "}— ou use o botão abaixo para gerar automaticamente a partir da letra simples.
            </p>
            <div className="flex gap-2 mb-2 flex-wrap">
              <button
                type="button"
                onClick={gerarLrc}
                className="text-xs px-3 py-1.5 rounded-lg border border-pink-500/30 text-pink-400 hover:bg-pink-500/10 transition-colors"
              >
                ✨ Gerar automaticamente
              </button>
              <button
                type="button"
                onClick={startTap}
                className="text-xs px-3 py-1.5 rounded-lg border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 transition-colors"
              >
                🥁 Sincronizar com tap
              </button>
            </div>
            <textarea
              rows={8}
              value={lyricsLrc}
              onChange={(e) => setLyricsLrc(e.target.value)}
              placeholder={"[00:00.00]Primeira linha\n[00:05.20]Segunda linha\n[00:10.80]Terceira linha"}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500 resize-none font-mono"
            />
          </div>

          {/* MP3 */}
          <div className="bg-black/30 border border-white/10 rounded-xl p-4">
            <label className="text-xs text-gray-500 mb-2 block">Arquivo MP3</label>

            {mp3Url ? (
              <div className="space-y-2">
                <audio ref={audioRef} controls src={mp3Url} className="w-full h-10" />
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

          {/* IMAGEM DE CAPA */}
          <div className="bg-black/30 border border-white/10 rounded-xl p-4">
            <label className="text-xs text-gray-500 mb-2 block">Imagem de capa (opcional)</label>

            {imageUrl ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Capa" className="w-32 h-32 rounded-xl object-cover border border-white/10" />
                <p className="text-xs text-gray-500 break-all">{imageUrl}</p>
                <button
                  onClick={() => { setImageUrl(""); if (imgRef.current) imgRef.current.value = "" }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remover imagem
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <label className={`cursor-pointer text-xs px-3 py-2 rounded-lg border transition-colors ${
                  uploadingImg
                    ? "border-white/5 text-gray-600 cursor-not-allowed"
                    : "border-pink-500/30 text-pink-400 hover:bg-pink-500/10"
                }`}>
                  {uploadingImg ? "Enviando…" : "🖼️ Selecionar imagem"}
                  <input
                    ref={imgRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImg}
                    className="hidden"
                  />
                </label>
                {uploadingImg && (
                  <span className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                )}
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
    </>
  )
}
