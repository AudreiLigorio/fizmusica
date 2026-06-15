"use client"

import { useEffect, useRef, useState } from "react"

type Photo = { id: string; url: string; is_cover: boolean; sort_order: number }

const MAX = 5

export default function OrderPhotosAdmin({ orderId }: { orderId: string }) {
  const [photos, setPhotos]     = useState<Photo[]>([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const res = await fetch(`/api/admin/pedidos/${orderId}/fotos`)
    const data = await res.json()
    setPhotos(data.photos ?? [])
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [orderId])

  async function upload(file: File) {
    setError(null)
    if (photos.length >= MAX) { setError(`Máximo de ${MAX} fotos.`); return }
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("is_cover", String(photos.length === 0))
    const res = await fetch(`/api/admin/pedidos/${orderId}/fotos`, { method: "POST", body: fd })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? "Erro ao enviar.")
    else await load()
    setUploading(false)
  }

  async function setCover(photoId: string) {
    await fetch(`/api/admin/pedidos/${orderId}/fotos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    })
    await load()
  }

  async function remove(photoId: string) {
    await fetch(`/api/admin/pedidos/${orderId}/fotos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    })
    await load()
  }

  if (loading) return <p className="text-xs text-gray-600">Carregando fotos…</p>

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">
        📸 Fotos do cliente ({photos.length}/{MAX})
        <span className="text-gray-600"> · clique em ★ para definir a capa</span>
      </p>

      {error && <p className="text-xs text-red-400 mb-2">❌ {error}</p>}

      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div
            key={p.id}
            className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 group ${
              p.is_cover ? "border-pink-500 shadow-[0_0_16px_rgba(236,72,153,0.25)]" : "border-white/10"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="w-full h-full object-cover" />

            {p.is_cover ? (
              <span className="absolute top-1 left-1 text-[9px] font-bold bg-pink-500 text-white px-1.5 py-0.5 rounded-full">★ CAPA</span>
            ) : (
              <button
                onClick={() => setCover(p.id)}
                className="absolute bottom-1 left-1 text-[9px] font-medium bg-black/60 hover:bg-black/80 text-white px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                title="Definir como capa"
              >★ capa</button>
            )}

            <button
              onClick={() => remove(p.id)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remover"
            >×</button>
          </div>
        ))}

        {photos.length < MAX && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-gray-600 hover:border-pink-500/50 hover:text-gray-400 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <span className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span className="text-2xl">+</span>
                <span className="text-[9px] mt-0.5">Adicionar</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = "" }}
      />
    </div>
  )
}
