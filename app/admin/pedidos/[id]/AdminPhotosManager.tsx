"use client"

import { useEffect, useRef, useState } from "react"

type Photo = { id: string; url: string; is_cover: boolean; sort_order: number }

export default function AdminPhotosManager({ orderId, initial }: { orderId: string; initial: Photo[] }) {
  const [photos, setPhotos]       = useState<Photo[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const apiBase = `/api/admin/pedidos/${orderId}/fotos`

  // Busca fotos direto da API para não depender do join SSR com coluna camelCase
  useEffect(() => {
    fetch(apiBase)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.photos)) setPhotos(d.photos) })
      .catch(() => {})
  }, [apiBase])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (photos.length >= 5) { setError("Máximo de 5 fotos atingido."); return }

    setUploading(true)
    setError("")
    const form = new FormData()
    form.append("file", file)
    form.append("is_cover", "false")

    try {
      const res  = await fetch(apiBase, { method: "POST", body: form })
      const data = await res.json()
      if (data.photo) setPhotos((p) => [...p, data.photo])
      else setError(data.error ?? "Erro ao enviar foto.")
    } catch {
      setError("Falha de conexão.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleDelete(photoId: string) {
    setPhotos((p) => p.filter((x) => x.id !== photoId))
    await fetch(apiBase, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    }).catch(() => {})
  }

  return (
    <div className="bg-black/40 border border-white/10 rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Fotos do cliente <span className="text-gray-600 normal-case">({photos.length}/5)</span>
        </h2>
        {photos.length < 5 && (
          <label className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            uploading
              ? "border-white/5 text-gray-600 cursor-not-allowed"
              : "border-pink-500/30 text-pink-400 hover:bg-pink-500/10"
          }`}>
            {uploading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border border-pink-500 border-t-transparent rounded-full animate-spin" />
                Enviando…
              </span>
            ) : "+ Adicionar foto"}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {photos.length === 0 ? (
        <p className="text-gray-600 text-sm">Nenhuma foto enviada ainda.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative rounded-xl overflow-hidden border-2 border-white/10 transition-all group" style={{ aspectRatio: "1/1" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="w-full h-full object-cover" />

              {/* Ações — aparecem no hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                <button
                  onClick={() => handleDelete(p.id)}
                  className="w-full text-[11px] font-semibold py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                >
                  Remover
                </button>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-[11px] text-center py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  Ver original ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-600 mt-4">Passe o mouse sobre a foto para ver as opções.</p>
    </div>
  )
}
