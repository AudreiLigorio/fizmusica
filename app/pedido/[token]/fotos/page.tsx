"use client"
export const dynamic = "force-dynamic"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"

type Photo = { id: string; url: string; is_cover: boolean; sort_order: number }

const MAX = 5

export default function FotosPage() {
  const { token } = useParams<{ token: string }>()

  const [nome, setNome]         = useState("")
  const [photos, setPhotos]     = useState<Photo[]>([])
  const [loading, setLoading]   = useState(true)
  const [invalid, setInvalid]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
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

  async function upload(file: File) {
    setError(null)
    if (photos.length >= MAX) { setError(`Máximo de ${MAX} fotos.`); return }
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    // primeira foto vira capa automaticamente
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
      <Header showButton={false} />

      <div className="px-5 pt-24 pb-16 max-w-2xl mx-auto">
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
                Ao enviar, você autoriza o uso das fotos apenas para exibição no player da sua música e declara ter o consentimento das pessoas retratadas (e dos responsáveis, se houver crianças). Saiba mais na{" "}
                <a href="/legal/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/60">Política de Privacidade</a>.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5 text-center">
                ❌ {error}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className={`relative rounded-2xl overflow-hidden border-2 transition-all ${
                    p.is_cover ? "border-pink-500 shadow-[0_0_24px_rgba(236,72,153,0.25)]" : "border-white/10"
                  }`}
                  style={{ aspectRatio: "1/1" }}
                >
                  <img src={p.url} alt="" className="w-full h-full object-cover" />

                  {p.is_cover && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold bg-pink-500 text-white px-2 py-0.5 rounded-full">
                      ★ CAPA
                    </span>
                  )}

                  <div className="absolute inset-0 flex items-end justify-between p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                    {!p.is_cover && (
                      <button
                        onClick={() => setCover(p.id)}
                        className="text-[11px] font-medium bg-white/15 hover:bg-white/25 backdrop-blur px-2 py-1 rounded-lg"
                      >
                        Definir capa
                      </button>
                    )}
                    <button
                      onClick={() => remove(p.id)}
                      className="ml-auto w-7 h-7 rounded-full bg-red-600 text-white text-sm flex items-center justify-center"
                      title="Remover"
                    >×</button>
                  </div>
                </div>
              ))}

              {photos.length < MAX && (
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
                      <span className="text-xs mt-1">Adicionar foto</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="text-center text-xs text-white/35 mb-2">
              {photos.length}/{MAX} fotos · JPG, PNG ou WebP · até 8 MB cada
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = "" }}
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
