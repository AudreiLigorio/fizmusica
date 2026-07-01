"use client"

import { useEffect, useRef, useState } from "react"
import PhotoCropModal from "@/app/components/PhotoCropModal"

type Photo = { id: string; url: string; is_cover: boolean; sort_order: number }

const MAX = 5

// Galeria de fotos inline (expansível dentro do card do pedido em /minha-musica).
// Mesma funcionalidade da página /pedido/[token]/fotos, sem trocar de tela.
export default function FotosPanel({ token, onChange }: { token: string; onChange?: () => void }) {
  const [photos, setPhotos]     = useState<Photo[]>([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [cropSrc, setCropSrc]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const res = await fetch(`/api/pedido/${token}/fotos`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setPhotos(data.photos ?? [])
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [token])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    setCropSrc(URL.createObjectURL(f))
  }

  async function upload(blob: Blob) {
    setError(null)
    setCropSrc(null)
    if (photos.length >= MAX) { setError(`Máximo de ${MAX} fotos.`); return }
    setUploading(true)
    const fd = new FormData()
    fd.append("file", blob, "foto.jpg")
    fd.append("is_cover", "false")
    const res = await fetch(`/api/pedido/${token}/fotos`, { method: "POST", body: fd })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? "Erro ao enviar.")
    else { await load(); onChange?.() }
    setUploading(false)
  }

  async function remove(photoId: string) {
    await fetch(`/api/pedido/${token}/fotos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    })
    await load(); onChange?.()
  }

  return (
    <div className="rounded-2xl border border-pink-500/25 bg-pink-500/[0.05] p-4 mb-1">
      {cropSrc && (
        <PhotoCropModal
          src={cropSrc}
          onConfirm={(blob) => { URL.revokeObjectURL(cropSrc); upload(blob) }}
          onCancel={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null) }}
        />
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-pink-200 font-semibold text-sm">📸 Suas fotos <span className="text-white/40 font-normal text-xs">(opcional)</span></p>
        <span className="text-white/30 text-[11px]">{photos.length}/{MAX}</span>
      </div>
      <p className="text-white/45 text-xs mb-4 leading-relaxed">
        Aparecem no player enquanto a música toca. Ao enviar, você declara ter o
        consentimento das pessoas retratadas e concorda com os{" "}
        <a href="/legal/direitos-autorais" className="underline hover:text-white/70">termos de Conteúdo Enviado</a>{" "}
        e a{" "}
        <a href="/legal/politica-de-privacidade" className="underline hover:text-white/70">Política de Privacidade</a>.
      </p>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3 text-center">❌ {error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {photos.map((p) => (
            <div key={p.id} className="relative rounded-xl overflow-hidden border-2 border-white/10" style={{ aspectRatio: "1/1" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => remove(p.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white text-sm font-bold flex items-center justify-center transition-colors"
                title="Remover foto"
              >×</button>
            </div>
          ))}

          {photos.length < MAX && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-white/40 hover:border-pink-500/50 hover:text-white/70 transition-colors disabled:opacity-50"
              style={{ aspectRatio: "1/1" }}
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <><span className="text-2xl leading-none">+</span><span className="text-[10px] mt-0.5">Adicionar</span></>
              )}
            </button>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileChange}
      />

      {photos.length > 0 && (
        <p className="text-center text-xs text-green-400/80 mt-3">✅ Fotos salvas.</p>
      )}
    </div>
  )
}
