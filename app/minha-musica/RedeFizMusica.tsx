"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type CatalogItem = {
  orderId: string
  slug: string
  title: string
  occasion: string
  musicalStyle: string | null
  imageUrl: string
  favorited: boolean
}

// Rede Fiz Música: músicas de outros clientes que autorizaram divulgação.
// Nunca mostra o nome do homenageado (dado de terceiro sem consentimento
// próprio) nem fotos do cliente — só título real da música + ocasião +
// capa gerada pelo Suno, tudo vindo direto do banco (nada fixo).
export default function RedeFizMusica() {
  const [items, setItems] = useState<CatalogItem[] | null>(null)
  const [ocasiaoAberta, setOcasiaoAberta] = useState<string | null>(null)

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" }
  }

  async function carregar() {
    const headers = await authHeaders()
    const res = await fetch("/api/catalog", { headers })
    const d = await res.json().catch(() => ({}))
    setItems(d.items ?? [])
  }

  useEffect(() => { carregar() }, [])

  async function favoritar(orderId: string) {
    // Otimista: alterna na hora e já reordena (favoritado sobe pro topo).
    setItems((prev) => {
      if (!prev) return prev
      const next = prev.map((it) => (it.orderId === orderId ? { ...it, favorited: !it.favorited } : it))
      return [...next].sort((a, b) => Number(b.favorited) - Number(a.favorited))
    })
    const headers = await authHeaders()
    await fetch("/api/catalog/favorite", { method: "POST", headers, body: JSON.stringify({ orderId }) }).catch(() => {})
  }

  if (!items || items.length === 0) return null

  // Agrupado por ocasião — o cliente navega por tema em vez de rolar tudo junto.
  const porOcasiao = new Map<string, CatalogItem[]>()
  for (const it of items) {
    const lista = porOcasiao.get(it.occasion) ?? []
    lista.push(it)
    porOcasiao.set(it.occasion, lista)
  }
  const ocasioes = [...porOcasiao.entries()].sort((a, b) => b[1].length - a[1].length)
  const visiveis = ocasiaoAberta ? porOcasiao.get(ocasiaoAberta) ?? [] : items

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">🎧 Ouvir na Rede Fiz Música</h3>
      <p className="text-xs text-white/50 mb-3">Músicas de outros clientes que decidiram publicar.</p>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-1 -mx-1 px-1">
        <button
          onClick={() => setOcasiaoAberta(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            ocasiaoAberta === null ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200" : "border-white/10 text-white/50 hover:text-white/80"
          }`}
        >
          Todas · {items.length}
        </button>
        {ocasioes.map(([ocasiao, lista]) => (
          <button
            key={ocasiao}
            onClick={() => setOcasiaoAberta(ocasiao)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              ocasiaoAberta === ocasiao ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200" : "border-white/10 text-white/50 hover:text-white/80"
            }`}
          >
            {ocasiao} · {lista.length}
          </button>
        ))}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {visiveis.map((it) => (
          <div key={it.orderId} className="shrink-0 w-32">
            <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-white/10">
              <a href={`/m/${it.slug}`} target="_blank" rel="noopener" className="block w-full h-full">
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${it.imageUrl})` }}
                />
              </a>
              <button
                onClick={() => favoritar(it.orderId)}
                aria-label={it.favorited ? "Remover dos favoritos" : "Favoritar"}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-sm transition-transform hover:scale-110"
              >
                {it.favorited ? "❤️" : "🤍"}
              </button>
            </div>
            <p className="text-xs font-medium mt-1.5 truncate">{it.title}</p>
            <p className="text-[11px] text-white/40 truncate">{it.occasion}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
