"use client"

import { useEffect, useRef, useState } from "react"

type ProductImage = {
  id: string
  url: string
  is_cover: boolean
  sort_order: number
}

export default function ProductImages({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false)
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/admin/produtos/${productId}/images`)
    const data = await res.json()
    setImages(data.images ?? [])
    setLoading(false)
  }

  useEffect(() => { if (open) load() }, [open])

  const cover = images.find((i) => i.is_cover)
  const photos = images.filter((i) => !i.is_cover).sort((a, b) => a.sort_order - b.sort_order)

  async function upload(file: File, isCover: boolean, sortOrder = 0) {
    setError(null)
    setUploading(isCover ? "cover" : `photo_${sortOrder}`)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("is_cover", String(isCover))
    fd.append("sort_order", String(sortOrder))
    const res = await fetch(`/api/admin/produtos/${productId}/images`, { method: "POST", body: fd })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? "Erro ao enviar.")
    else await load()
    setUploading(null)
  }

  async function remove(imageId: string) {
    setError(null)
    const res = await fetch(`/api/admin/produtos/${productId}/images`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? "Erro ao remover.")
    } else await load()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-500 hover:text-white flex items-center gap-1.5 mt-3 transition-colors"
      >
        🖼 Gerenciar fotos {cover ? "· ✅ Capa" : "· ⚠️ Sem capa"} {photos.length > 0 ? `· ${photos.length}/4 fotos` : ""}
      </button>
    )
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/10 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-300">🖼 Fotos do produto</p>
        <button onClick={() => setOpen(false)} className="text-xs text-gray-600 hover:text-gray-400">Fechar ↑</button>
      </div>

      {error && <p className="text-xs text-red-400">❌ {error}</p>}

      {/* FOTO CAPA */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Foto capa</p>
        <div className="flex items-start gap-3">
          {cover ? (
            <div className="relative group">
              <img
                src={cover.url}
                alt="Capa"
                className="w-24 h-24 object-cover rounded-xl border border-white/10"
              />
              <button
                onClick={() => remove(cover.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remover"
              >×</button>
              <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">Capa</span>
            </div>
          ) : (
            <div
              onClick={() => coverRef.current?.click()}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-pink-500/50 transition-colors text-gray-600 hover:text-gray-400"
            >
              {uploading === "cover" ? (
                <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="text-2xl">+</span>
                  <span className="text-[10px] mt-0.5">Capa</span>
                </>
              )}
            </div>
          )}

          {/* Botão trocar capa mesmo se já existe */}
          {cover && (
            <button
              onClick={() => coverRef.current?.click()}
              disabled={uploading === "cover"}
              className="text-xs text-gray-500 hover:text-white transition-colors disabled:opacity-40 self-center"
            >
              {uploading === "cover" ? "Enviando…" : "Trocar capa"}
            </button>
          )}

          <input
            ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, true); e.target.value = "" }}
          />
        </div>
      </div>

      {/* FOTOS ADICIONAIS */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
          Fotos adicionais ({photos.length}/4)
        </p>
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative group">
              <img
                src={p.url}
                alt="Foto"
                className="w-20 h-20 object-cover rounded-xl border border-white/10"
              />
              <button
                onClick={() => remove(p.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remover"
              >×</button>
            </div>
          ))}

          {photos.length < 4 && (
            <div
              onClick={() => photoRef.current?.click()}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-pink-500/50 transition-colors text-gray-600 hover:text-gray-400"
            >
              {uploading?.startsWith("photo_") ? (
                <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="text-2xl">+</span>
                  <span className="text-[10px] mt-0.5">Foto</span>
                </>
              )}
            </div>
          )}

          <input
            ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f, false, photos.length + 1)
              e.target.value = ""
            }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-2">JPG, PNG ou WebP · máx. 5 MB · tamanho ideal: <span className="text-gray-400">1200 × 900 px (proporção 4:3)</span></p>
      </div>

      {loading && <p className="text-xs text-gray-600">Carregando…</p>}
    </div>
  )
}
