"use client"

import { useEffect, useRef, useState } from "react"
import PhotoCropModal from "@/app/components/PhotoCropModal"

type Photo = { id: string; url: string; is_cover: boolean; sort_order: number }

const DEFAULT_MAX = 10 // usado só até a resposta do servidor chegar com o limite real

// Galeria de fotos inline (expansível dentro do card do pedido em /minha-musica).
// Mesma funcionalidade da página /pedido/[token]/fotos, sem trocar de tela.
export default function FotosPanel({ token, onChange }: { token: string; onChange?: () => void }) {
  const [photos, setPhotos]     = useState<Photo[]>([])
  const [max, setMax]           = useState(DEFAULT_MAX) // limite do produto do pedido
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [cropSrc, setCropSrc]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // try/catch em volta do fetch: sem ele, uma falha de rede deixava
  // `loading` preso em true pra sempre — a tela ficava carregando sem nunca
  // dizer o que houve. Ver o `finally`.
  async function load() {
    try {
    const res = await fetch(`/api/pedido/${token}/fotos`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setPhotos(data.photos ?? [])
    // "!= null" e não truthy: produto sem fotos manda photoLimit=0, que é um
    // valor real (não "ainda não chegou") — checagem truthy travava no
    // DEFAULT_MAX e mostrava "1/10" pra um produto que não tem fotos.
    if (data.photoLimit != null) setMax(data.photoLimit)
    } catch {
      /* rede caiu: segue sem fotos em vez de derrubar a tela */
    } finally {
      setLoading(false)
    }
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
    if (photos.length >= max) { setError(`Máximo de ${max} fotos.`); return }
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

  // Move uma foto do cliente uma posição pra frente/trás (a capa gerada pela IA, se houver, não entra na troca)
  async function move(photoId: string, dir: -1 | 1) {
    const reorderable = photos.filter((p) => !p.is_cover)
    const i = reorderable.findIndex((p) => p.id === photoId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= reorderable.length) return
    const ids = reorderable.map((p) => p.id)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    setPhotos((prev) => {
      const cover = prev.filter((p) => p.is_cover)
      const byId = new Map(prev.map((p) => [p.id, p]))
      return [...cover, ...ids.map((id) => byId.get(id)!)]
    })
    await fetch(`/api/pedido/${token}/fotos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder: ids }),
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
        <span className="text-white/30 text-[11px]">{photos.length}/{max}</span>
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
          {(() => {
            let ri = -1
            return photos.map((p) => {
              if (!p.is_cover) ri++
              const reorderableCount = photos.filter((x) => !x.is_cover).length
              return (
                <div key={p.id} className="relative rounded-xl overflow-hidden border-2 border-white/10" style={{ aspectRatio: "1/1" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => remove(p.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white text-sm font-bold flex items-center justify-center transition-colors"
                    title="Remover foto"
                  >×</button>
                  {!p.is_cover && reorderableCount > 1 && (
                    <div className="absolute bottom-1 inset-x-1 flex justify-between">
                      <button
                        onClick={() => move(p.id, -1)}
                        disabled={ri === 0}
                        className="w-6 h-6 rounded-full bg-black/60 hover:bg-pink-600 text-white text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-black/60"
                        title="Mover para trás"
                      >‹</button>
                      <button
                        onClick={() => move(p.id, 1)}
                        disabled={ri === reorderableCount - 1}
                        className="w-6 h-6 rounded-full bg-black/60 hover:bg-pink-600 text-white text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-black/60"
                        title="Mover para frente"
                      >›</button>
                    </div>
                  )}
                </div>
              )
            })
          })()}

          {photos.length < max && (
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
