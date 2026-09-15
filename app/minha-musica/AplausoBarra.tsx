"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"

// Medidor de aplauso — arrasta e solta pra dar de 1 a 10 palmas.
//
// Por que medidor de volume e não nota: metade do acervo é luto (despedida
// de pet, homenagem a quem morreu). Nota pública vira veredito sobre a
// memória de alguém, e com o volume de hoje UM voto definiria a média.
// Aplauso é só positivo — quem gostou pouco aplaude pouco, e nenhuma música
// exibe nota baixa.
//
// Depois de aplaudir a faixa ENCOLHE e vira leitura: ela só ocupa espaço de
// controle enquanto é controle. Em toda escuta seguinte, é informação.
//
// Fica entre o autor e a fileira dos três botões, e não como um quarto
// círculo: os círculos são de um toque, este é de arrastar — vira botão e o
// gesto some. Arrasto horizontal também não briga com o "arraste para cima"
// do sheet da letra.

const SEGMENTOS = 10

function corDoSegmento(i: number) {
  const p = i / (SEGMENTOS - 1)
  const r = Math.round(240 + (217 - 240) * p)
  const g = Math.round(25 + (70 - 25) * p)
  const b = Math.round(107 + (239 - 107) * p)
  return `rgb(${r},${g},${b})`
}

// Segmentos acesos do rosa ao roxo da marca, nunca verde→vermelho: em
// medidor de verdade o topo é distorção, aqui o topo é o melhor que pode
// acontecer.
function Segmentos({ n, altura, brilho }: { n: number; altura: number; brilho?: boolean }) {
  return (
    <div className="flex gap-[3px] w-full" style={{ height: altura }}>
      {Array.from({ length: SEGMENTOS }, (_, i) => (
        <div
          key={i}
          className="flex-1 rounded-[2px] transition-colors duration-100"
          style={{
            background: i < n ? corDoSegmento(i) : "rgba(255,255,255,0.07)",
            boxShadow: i < n && brilho ? `0 0 6px ${corDoSegmento(i)}` : undefined,
          }}
        />
      ))}
    </div>
  )
}

export default function AplausoBarra({
  orderId,
  logado,
  onPrecisaConta,
}: {
  orderId: string
  logado: boolean | null
  onPrecisaConta: () => void
}) {
  const [total, setTotal] = useState(0)
  const [minhas, setMinhas] = useState(0)
  const [valor, setValor] = useState(0)
  // Reabre o medidor pra quem já aplaudiu e quer dar mais.
  const [aumentando, setAumentando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const pedido = useRef<string | null>(null)

  useEffect(() => {
    let vivo = true
    pedido.current = orderId
    setValor(0)
    setAumentando(false)
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch(`/api/rede/aplauso?orderId=${encodeURIComponent(orderId)}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      }).then((x) => x.json()).catch(() => null)
      // Troca de faixa no meio da resposta colaria o número na música errada.
      if (!vivo || pedido.current !== orderId || !r) return
      setTotal(r.total ?? 0); setMinhas(r.minhas ?? 0)
    })()
    return () => { vivo = false }
  }, [orderId])

  async function aplaudir(n: number) {
    if (logado === false) { onPrecisaConta(); return }
    if (n < 1 || enviando) return
    setEnviando(true)
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch("/api/rede/aplauso", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ orderId, palmas: n }),
    }).then((x) => x.json()).catch(() => null)
    setEnviando(false)
    if (!r || r.error) { if (r?.error) onPrecisaConta(); return }
    setTotal(r.total ?? 0); setMinhas(r.minhas ?? 0)
    setValor(0)
    setAumentando(false)
  }

  const teto = SEGMENTOS
  // Arrastar abaixo do que já foi dado não faz nada no banco (só aumenta),
  // então o controle nem deixa chegar lá — gesto que não tem efeito confunde.
  const piso = aumentando ? minhas : 0

  // Já aplaudiu: vira leitura compacta — mas continua sendo um botão, porque
  // aumentar é permitido. Sem isso a promessa de "dá pra aumentar depois"
  // não tinha por onde acontecer (furo achado pelo Audrei).
  if (minhas > 0 && !aumentando) {
    const noTeto = minhas >= SEGMENTOS
    return (
      <button
        type="button"
        onClick={() => { if (!noTeto) { setValor(minhas); setAumentando(true) } }}
        disabled={noTeto}
        className="mt-4 w-full flex items-center justify-center gap-2.5 rounded-xl px-3 py-2 disabled:cursor-default"
        style={{ background: "rgba(240,25,107,0.08)", border: "1px solid rgba(240,25,107,0.25)" }}
      >
        <div className="w-16"><Segmentos n={minhas} altura={10} /></div>
        <span className="text-[11px] text-white tabular-nums">{total.toLocaleString("pt-BR")}</span>
        <span className="text-[11px] text-white/50">{total === 1 ? "palma" : "palmas"}</span>
        <span className="text-[10px] text-white/35">
          · você deu {minhas}{noTeto ? " (máximo)" : " · aumentar"}
        </span>
      </button>
    )
  }

  return (
    <div className="mt-4 rounded-xl px-3 py-2.5" style={{ background: "#0d0b14", border: "1px solid rgba(255,255,255,0.09)" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] uppercase tracking-[0.1em] text-white/35">
          {aumentando ? `Aumentar — você deu ${minhas}` : "Seu aplauso"}
        </span>
        <span className="text-[10px] text-white/35 tabular-nums">
          {total > 0 ? `${total.toLocaleString("pt-BR")} palmas` : "seja o primeiro"}
        </span>
      </div>

      <div className="relative">
        <Segmentos n={valor} altura={22} brilho />

        {/* Controle nativo por cima, invisível: o desenho é nosso, mas quem
            recebe o arrasto é um <input>, então teclado e leitor de tela
            funcionam sem reimplementar nada.
            O envio vai no SOLTAR (`pointerup`/`keyup`), nunca no `onChange`:
            no React, `onChange` de range dispara a cada passo do arrasto, e o
            aplauso sairia no primeiro milímetro — medido na tela antes de
            subir. */}
        <input
          type="range"
          min={piso}
          max={teto}
          step={1}
          value={valor}
          aria-label="Quanto você aplaude, de 0 a 10"
          disabled={enviando}
          onChange={(e) => setValor(Number(e.target.value))}
          onPointerDown={() => { if (logado === false) onPrecisaConta() }}
          // Lê do PRÓPRIO input, não do estado. Quando o dedo levanta, o
          // React pode ainda não ter processado o último passo do arrasto —
          // e aí `valor` no fecho é o anterior. Como o aplauso só aumenta,
          // mandar o valor antigo não muda nada: era exatamente o sintoma de
          // "abre mas não edita" (Audrei, 2026-09-15). O elemento sempre tem
          // o número certo.
          onPointerUp={(e) => aplaudir(Number((e.currentTarget as HTMLInputElement).value))}
          onKeyUp={(e) => {
            if (/Arrow|Home|End|Enter| /.test(e.key)) aplaudir(Number((e.currentTarget as HTMLInputElement).value))
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[9px] text-white/30">SILÊNCIO</span>
        <span className="text-[9px] text-white/30">DE PÉ</span>
      </div>
    </div>
  )
}
