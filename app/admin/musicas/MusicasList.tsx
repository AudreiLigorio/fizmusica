"use client"

import { useMemo, useState } from "react"
import { fmtDateTimeBR } from "@/lib/date"

type Musica = {
  id: string
  code: string
  orderId: string
  nome: string
  subcategory: string
  musicName: string | null
  personName: string | null
  publicationConsent: boolean
  views: number
  publishedAt: string | null
  linkActive: boolean
  url: string | null
}

export default function MusicasList({ initial }: { initial: Musica[] }) {
  const [search, setSearch] = useState("")
  const [onlyConsent, setOnlyConsent] = useState(false)
  const [sortBy, setSortBy] = useState<"views" | "date">("views")
  const [copied, setCopied] = useState("")

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(""), 1500)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = initial.filter((m) => {
      if (onlyConsent && !m.publicationConsent) return false
      if (!q) return true
      return (
        m.code.toLowerCase().includes(q) ||
        m.nome.toLowerCase().includes(q) ||
        (m.musicName ?? "").toLowerCase().includes(q) ||
        (m.personName ?? "").toLowerCase().includes(q) ||
        m.subcategory.toLowerCase().includes(q)
      )
    })
    list = [...list].sort((a, b) =>
      sortBy === "views"
        ? b.views - a.views
        : new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()
    )
    return list
  }, [initial, search, onlyConsent, sortBy])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, nome, ocasião..."
          className="flex-1 min-w-[220px] bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500"
        />
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={onlyConsent} onChange={(e) => setOnlyConsent(e.target.checked)} className="accent-pink-500" />
          Só autorizados p/ publicação
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "views" | "date")}
          className="bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500"
        >
          <option value="views">Ordenar por views</option>
          <option value="date">Ordenar por data</option>
        </select>
      </div>

      <p className="text-xs text-gray-600 mb-3">Mostrando {filtered.length} de {initial.length} música(s).</p>

      {filtered.length === 0 ? (
        <p className="text-gray-600 text-sm">Nenhuma música encontrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/10">
                <th className="text-left py-2 pr-4 font-medium">Pedido</th>
                <th className="text-left py-2 px-4 font-medium">Cliente / Ocasião</th>
                <th className="text-center py-2 px-4 font-medium">Publicação</th>
                <th className="text-right py-2 px-4 font-medium">Views</th>
                <th className="text-left py-2 px-4 font-medium">Publicada em</th>
                <th className="text-center py-2 px-4 font-medium">Link</th>
                <th className="text-right py-2 pl-4 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-white/5">
                  <td className="py-2.5 pr-4 font-mono text-pink-300">#{m.code}</td>
                  <td className="py-2.5 px-4">
                    <p className="text-gray-200">{m.musicName || m.personName || m.nome}</p>
                    <p className="text-gray-600 text-xs">{m.subcategory}</p>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {m.publicationConsent
                      ? <span className="text-[11px] font-semibold bg-green-500/15 text-green-300 px-2 py-0.5 rounded-full">✅ autorizado</span>
                      : <span className="text-[11px] font-medium bg-white/5 text-gray-500 px-2 py-0.5 rounded-full">não autorizado</span>}
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-300">{m.views}</td>
                  <td className="py-2.5 px-4 text-gray-500">{m.publishedAt ? fmtDateTimeBR(m.publishedAt) : "—"}</td>
                  <td className="py-2.5 px-4 text-center">
                    {m.linkActive
                      ? <span className="text-[11px] text-green-400">ativo</span>
                      : <span className="text-[11px] text-gray-600">🔒 desativado</span>}
                  </td>
                  <td className="py-2.5 pl-4 text-right">
                    {m.url && (
                      <div className="flex items-center justify-end gap-2">
                        <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">abrir</a>
                        <button onClick={() => copyUrl(m.url!)} className="text-xs text-gray-500 hover:text-white">{copied === m.url ? "✓" : "copiar"}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
