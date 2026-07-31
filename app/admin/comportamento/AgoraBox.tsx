"use client"

import { useEffect, useState } from "react"

type Pessoa = { caminho: string | null; evento: string; detalhe: string | null; origem: string; visto: string }

const ROTULO: Record<string, string> = {
  pageview: "abriu a página",
  ping: "está lendo",
  cta_criar: "clicou em criar música",
  wizard_passo: "está no wizard",
  checkout: "está no pagamento",
  pago: "acabou de pagar",
}

// Quem está no site agora. Atualiza a cada 15s — o batimento do visitante é de
// 1 minuto, então atualizar mais rápido não traria informação nova.
export default function AgoraBox() {
  const [online, setOnline] = useState<number | null>(null)
  const [pessoas, setPessoas] = useState<Pessoa[]>([])

  async function carregar() {
    try {
      const d = await fetch("/api/admin/comportamento/agora", { cache: "no-store" }).then((r) => r.json())
      setOnline(d.online ?? 0)
      setPessoas(d.pessoas ?? [])
    } catch { /* tenta de novo no próximo ciclo */ }
  }

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 15000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-full ${online ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
        <h2 className="text-white/80 text-sm font-semibold">
          {online === null ? "verificando…" : online === 0 ? "Ninguém no site agora" : `${online} pessoa(s) no site agora`}
        </h2>
      </div>

      {pessoas.length > 0 && (
        <ul className="space-y-1.5">
          {pessoas.map((p, i) => (
            <li key={i} className="text-[13px] flex justify-between gap-3">
              <span className="text-white/70">
                {ROTULO[p.evento] ?? p.evento}
                {p.detalhe && <span className="text-white/40"> ({p.detalhe})</span>}
                {p.caminho && <code className="text-white/45 ml-1">{p.caminho}</code>}
              </span>
              <span className="text-white/35 shrink-0">via {p.origem}</span>
            </li>
          ))}
        </ul>
      )}

      {online === 0 && (
        <p className="text-white/35 text-[11px]">
          Conta quem deu algum sinal nos últimos 3 minutos, com a aba aberta e visível.
        </p>
      )}
    </div>
  )
}
