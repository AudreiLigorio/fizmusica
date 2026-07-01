"use client"
export const dynamic = "force-dynamic"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { useRouter } from "next/navigation"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"
import PhotoCropModal from "@/app/components/PhotoCropModal"

type Photo = { id: string; url: string; is_cover: boolean; sort_order: number }

const MAX = 5

// ─── Página principal ─────────────────────────────────────────────────────────
export default function FotosPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [nome, setNome]         = useState("")
  const [photos, setPhotos]     = useState<Photo[]>([])
  const [loading, setLoading]   = useState(true)
  const [invalid, setInvalid]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [cropSrc, setCropSrc]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const res = await fetch(`/api/pedido/${token}/fotos`)
    if (!res.ok) { setInvalid(true); setLoading(false); return }
    const data = await res.json()
    setNome(data.nome ?? "")
    setPhotos(data.photos ?? [])
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [token])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    const url = URL.createObjectURL(f)
    setCropSrc(url)
  }

  async function upload(blob: Blob) {
    setError(null)
    setCropSrc(null)
    if (photos.length >= MAX) { setError(`Máximo de ${MAX} fotos.`); return }
    setUploading(true)
    const fd = new FormData()
    fd.append("file", blob, "foto.jpg")
    fd.append("is_cover", String(photos.length === 0))
    const res = await fetch(`/api/pedido/${token}/fotos`, { method: "POST", body: fd })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? "Erro ao enviar.")
    else await load()
    setUploading(false)
  }

  async function setCover(photoId: string) {
    await fetch(`/api/pedido/${token}/fotos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    })
    await load()
  }

  async function remove(photoId: string) {
    await fetch(`/api/pedido/${token}/fotos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    })
    await load()
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {cropSrc && (
        <PhotoCropModal
          src={cropSrc}
          onConfirm={(blob) => { URL.revokeObjectURL(cropSrc); upload(blob) }}
          onCancel={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null) }}
        />
      )}
      <Header showButton={false} />

      <div className="px-5 pt-24 pb-16 max-w-2xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/80 transition-colors mb-6"
        >
          ← Voltar
        </button>
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invalid ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl p-6 text-center">
            <p className="text-lg font-semibold mb-1">Link inválido ou expirado</p>
            <p className="text-sm text-red-300/70">Verifique o link enviado no seu e-mail.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="text-5xl mb-3">📸</div>
              <h1 className="text-2xl font-bold mb-2">
                {nome ? `${nome.split(" ")[0]}, ` : ""}adicione suas fotos
              </h1>
              <p className="text-white/55 text-sm leading-relaxed">
                Até {MAX} fotos que vão aparecer junto da sua música. Toque em uma para defini-la como capa.
                <br />É opcional — você pode voltar por este link quando quiser.
              </p>
              <p className="text-white/35 text-[11px] leading-relaxed mt-3 max-w-sm mx-auto">
                Ao enviar, você autoriza o uso das fotos apenas para exibição no player da sua música e declara ter o consentimento das pessoas retratadas (e dos responsáveis, se houver crianças), conforme os{" "}
                <a href="/legal/direitos-autorais" className="underline hover:text-white/60">termos de Conteúdo Enviado</a>{" "}
                e a{" "}
                <a href="/legal/politica-de-privacidade" className="underline hover:text-white/60">Política de Privacidade</a>.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5 text-center">
                ❌ {error}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {photos.map((p) => (
                <div key={p.id} className="flex flex-col gap-1.5">
                  {/* Miniatura */}
                  <div
                    className={`relative rounded-2xl overflow-hidden border-2 transition-all ${
                      p.is_cover
                        ? "border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                        : "border-white/10"
                    }`}
                    style={{ aspectRatio: "1/1" }}
                  >
                    <img src={p.url} alt="" className="w-full h-full object-cover" />

                    {/* Badge capa */}
                    {p.is_cover && (
                      <span className="absolute top-2 left-2 text-[10px] font-bold bg-pink-500 text-white px-2 py-0.5 rounded-full shadow">
                        ★ CAPA
                      </span>
                    )}

                    {/* Botão remover — sempre visível, canto superior direito */}
                    <button
                      onClick={() => remove(p.id)}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 hover:bg-red-600 text-white text-base font-bold flex items-center justify-center transition-colors backdrop-blur-sm"
                      title="Remover foto"
                    >×</button>
                  </div>

                  {/* Botão definir capa — abaixo da foto, sempre visível */}
                  {!p.is_cover ? (
                    <button
                      onClick={() => setCover(p.id)}
                      className="w-full text-[11px] font-semibold py-1.5 rounded-xl border border-pink-500/30 text-pink-300 hover:bg-pink-500/10 transition-colors"
                    >
                      ★ Definir capa
                    </button>
                  ) : (
                    <span className="w-full text-center text-[11px] text-pink-400/60 py-1.5">
                      Foto de capa
                    </span>
                  )}
                </div>
              ))}

              {/* Slot adicionar */}
              {photos.length < MAX && (
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-white/40 hover:border-pink-500/50 hover:text-white/70 transition-colors disabled:opacity-50"
                    style={{ aspectRatio: "1/1" }}
                  >
                    {uploading ? (
                      <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="text-3xl">+</span>
                        <span className="text-xs mt-1">Adicionar</span>
                      </>
                    )}
                  </button>
                  <span className="w-full text-center text-[11px] text-white/20 py-1.5">
                    {MAX - photos.length} restante{MAX - photos.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-white/30 mb-2">
              {photos.length}/{MAX} fotos · JPG, PNG ou WebP · até 8 MB cada
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onFileChange}
            />

            {photos.length > 0 && (
              <p className="text-center text-sm text-green-400 mt-6">
                ✅ Suas fotos foram salvas. Pode fechar esta página.
              </p>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}
