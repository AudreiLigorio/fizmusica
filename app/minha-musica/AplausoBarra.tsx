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
  // Reabre o medidor pra quem já aplaudiu e quer ajustar (só na 1ª hora).
  const [aumentando, setAumentando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  // Fim da janela de ajuste (1h depois do PRIMEIRO aplauso — migração 067).
  const [editavelAte, setEditavelAte] = useState<string | null>(null)
  // Explicação de por que não dá mais pra mexer, aberta ao tocar na barra.
  const [explicando, setExplicando] = useState(false)
  // Força um novo desenho quando a janela fecha com a tela aberta.
  const [, setTique] = useState(0)
  const pedido = useRef<string | null>(null)
  const trilho = useRef<HTMLDivElement>(null)
  const arrastando = useRef(false)
  // O soltar lê daqui, não do estado: o último setValor do arrasto pode
  // ainda não ter sido processado quando o dedo levanta.
  const valorRef = useRef(0)
  valorRef.current = valor

  useEffect(() => {
    let vivo = true
    pedido.current = orderId
    setValor(0)
    setAumentando(false)
    setExplicando(false)
    setEditavelAte(null)
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch(`/api/rede/aplauso?orderId=${encodeURIComponent(orderId)}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      }).then((x) => x.json()).catch(() => null)
      // Troca de faixa no meio da resposta colaria o número na música errada.
      if (!vivo || pedido.current !== orderId || !r) return
      setTotal(r.total ?? 0); setMinhas(r.minhas ?? 0); setEditavelAte(r.editavelAte ?? null)
    })()
    return () => { vivo = false }
  }, [orderId])

  async function aplaudir(n: number) {
    if (n < 1 || enviando) return
    setEnviando(true)
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch("/api/rede/aplauso", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ orderId, palmas: n }),
    }).then((x) => x.json()).catch(() => null)
    setEnviando(false)
    // Sessão expirada no meio do caminho: o servidor recusa (401) e aí sim o
    // convite faz sentido. Qualquer outra falha só desfaz o arrasto — antes
    // TODO erro abria "crie sua conta", inclusive pra quem já tinha conta.
    // A hora acabou com o medidor aberto: volta pra leitura e explica.
    if (r?.travado) {
      setTotal(r.total ?? 0); setMinhas(r.minhas ?? 0); setEditavelAte(r.editavelAte ?? null)
      setValor(0); setAumentando(false); setExplicando(true)
      return
    }
    if (!r || r.error) { setValor(0); if (r?.error && /conta/i.test(r.error)) onPrecisaConta(); return }
    setTotal(r.total ?? 0); setMinhas(r.minhas ?? 0); setEditavelAte(r.editavelAte ?? null)
    setValor(0)
    setAumentando(false)
  }

  const fimDaJanela = editavelAte ? new Date(editavelAte).getTime() : 0
  const podeAjustar = minhas > 0 && fimDaJanela > Date.now()

  // Redesenha quando a janela fecha, pra o "ajustar" não ficar oferecido
  // depois da hora (a pessoa pode deixar o player aberto).
  useEffect(() => {
    if (!podeAjustar) return
    const t = setTimeout(() => setTique((x) => x + 1), fimDaJanela - Date.now() + 500)
    return () => clearTimeout(t)
  }, [podeAjustar, fimDaJanela])

  // Visitante (ou login ainda sendo conferido): NÃO ganha o controle de
  // arrastar. Antes ganhava, e o resultado era enganoso — os segmentos
  // acendiam com o dedo como se a palma tivesse sido dada, o convite de
  // cadastro abria duas vezes (ao encostar e ao soltar) e, fechado o
  // convite, a barra ficava acesa com um valor que nunca foi salvo
  // (Audrei, 2026-10-09). Agora é um botão: mostra o total e, num toque,
  // abre o convite UMA vez.
  if (logado !== true) {
    return (
      <button
        type="button"
        onClick={() => { if (logado === false) onPrecisaConta() }}
        className="mt-4 w-full rounded-xl px-3 py-2.5 text-left"
        style={{ background: "#0d0b14", border: "1px solid rgba(255,255,255,0.09)" }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] uppercase tracking-[0.1em] text-white/35">Aplausos</span>
          <span className="text-[13px] text-white/35 tabular-nums">
            {total > 0 ? `${total.toLocaleString("pt-BR")} ${total === 1 ? "palma" : "palmas"}` : "seja o primeiro"}
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 h-[22px] rounded-md"
             style={{ background: "rgba(240,25,107,0.08)", border: "1px dashed rgba(240,25,107,0.35)" }}>
          <span className="text-[13px] font-semibold text-white/80">👏 Toque para aplaudir</span>
        </div>
      </button>
    )
  }

  const teto = SEGMENTOS
  // Ajustando (1ª hora) dá pra baixar até 1 — tirar tudo não é ajuste, e o
  // registro do aplauso fica. Primeira vez começa do zero.
  const piso = aumentando ? 1 : 0

  // Posição do dedo → número de palmas, na MESMA escala do desenho (0 a 10
  // na largura inteira). Arredonda pra cima: tocar em qualquer parte de um
  // segmento acende até ele.
  function valorNoPonto(x: number) {
    const r = trilho.current?.getBoundingClientRect()
    if (!r || r.width === 0) return valorRef.current
    const n = Math.ceil(((x - r.left) / r.width) * teto)
    return Math.min(teto, Math.max(piso, n))
  }

  // Já aplaudiu: vira leitura compacta. Na primeira hora continua sendo
  // botão (ajustar); depois, o toque abre a explicação de por que ficou fixo
  // — sem ela a barra parecia simplesmente quebrada (Audrei, 2026-10-09).
  if (minhas > 0 && !aumentando) {
    const ate = podeAjustar
      ? new Date(fimDaJanela).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : null
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => {
            if (podeAjustar) { setValor(minhas); setAumentando(true); setExplicando(false) }
            else setExplicando((v) => !v)
          }}
          aria-expanded={podeAjustar ? undefined : explicando}
          className="w-full flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-xl px-3 py-2"
          style={{ background: "rgba(240,25,107,0.08)", border: "1px solid rgba(240,25,107,0.25)" }}
        >
          <div className="w-16"><Segmentos n={minhas} altura={10} /></div>
          <span className="text-[13px] text-white tabular-nums">{total.toLocaleString("pt-BR")}</span>
          <span className="text-[13px] text-white/50">{total === 1 ? "palma" : "palmas"}</span>
          <span className="text-[12px] text-white/35">
            · você deu {minhas}{podeAjustar ? ` · ajustar até ${ate}` : " 🔒"}
          </span>
        </button>
        {explicando && !podeAjustar && (
          <p className="mt-2 rounded-lg px-3 py-2 text-[13px] leading-relaxed text-white/70"
             style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            🔒 Seu aplauso já está valendo. Dá pra ajustar só na <strong className="text-white">primeira hora</strong> depois
            de aplaudir — depois ele fica fixo, porque o ranking das músicas mais aplaudidas da Rede é feito com as
            palmas. Se elas pudessem mudar a qualquer hora, o ranking deixaria de ser justo.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-xl px-3 py-2.5" style={{ background: "#0d0b14", border: "1px solid rgba(255,255,255,0.09)" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-[0.1em] text-white/35">
          {aumentando ? `Ajustar — você deu ${minhas}` : "Seu aplauso"}
        </span>
        {aumentando && (
          <button type="button" onClick={() => { setAumentando(false); setValor(0) }}
                  className="text-[13px] text-white/45 hover:text-white/70">cancelar</button>
        )}
        <span className="text-[13px] text-white/35 tabular-nums">
          {total > 0 ? `${total.toLocaleString("pt-BR")} palmas` : "seja o primeiro"}
        </span>
      </div>

      {/* O MEDIDOR TRATA O DEDO ELE MESMO. Antes era um <input type=range>
          invisível por cima do desenho, e o "aumentar" não funcionava
          (2026-10-09: nenhuma palma aumentada desde 15/09): no modo aumentar o
          range ia de `minhas` a 10, então a alça invisível ficava no COMEÇO
          da barra enquanto o desenho mostrava 9 segmentos acesos — e no
          iPhone o range só responde se o dedo pegar a alça. A pessoa tocava
          no fim da parte acesa e nada mexia.
          Agora: a posição do dedo na largura toda vira 0–10 (a MESMA escala
          do desenho), nunca abaixo do piso; toque simples também vale; grava
          ao soltar. `touch-action: none` impede o navegador de roubar o gesto
          (rolagem/fechar o player) e cancelar no meio. */}
      <div
        ref={trilho}
        role="slider"
        tabIndex={0}
        aria-label="Quanto você aplaude, de 0 a 10"
        aria-valuemin={0}
        aria-valuemax={teto}
        aria-valuenow={valor}
        aria-disabled={enviando}
        className="relative cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-pink-500/60 rounded"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          if (enviando) return
          e.stopPropagation()
          arrastando.current = true
          // Captura: o arrasto continua valendo mesmo se o dedo sair da
          // barra. Protegida — se o navegador recusar, o toque segue sem ela.
          try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* segue sem captura */ }
          setValor(valorNoPonto(e.clientX))
        }}
        onPointerMove={(e) => {
          if (!arrastando.current) return
          setValor(valorNoPonto(e.clientX))
        }}
        onPointerUp={(e) => {
          if (!arrastando.current) return
          arrastando.current = false
          aplaudir(valorNoPonto(e.clientX))
        }}
        onPointerCancel={() => {
          // O gesto foi tomado (não deveria, com touch-action none). Grava o
          // que já estava aceso em vez de perder o aplauso calado.
          if (!arrastando.current) return
          arrastando.current = false
          aplaudir(valorRef.current)
        }}
        onKeyDown={(e) => {
          if (enviando) return
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); setValor((v) => Math.min(teto, Math.max(piso, v + 1))) }
          else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); setValor((v) => Math.max(piso, v - 1)) }
          else if (e.key === "End") { e.preventDefault(); setValor(teto) }
          else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aplaudir(valorRef.current) }
        }}
      >
        <Segmentos n={valor} altura={22} brilho />
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-white/30">SILÊNCIO</span>
        <span className="text-[11px] text-white/30">DE PÉ</span>
      </div>
    </div>
  )
}
