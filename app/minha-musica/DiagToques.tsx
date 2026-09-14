"use client"

import { useEffect, useState } from "react"

// Diagnóstico TEMPORÁRIO da travada pós-compartilhamento (2026-09-14).
//
// O que já sabemos: com a tela travada, a música segue e o progresso corre —
// ou seja, a thread principal está viva e o React renderizando. O que morre é
// a entrega do toque. Girar o aparelho não devolve, então não parece ser a
// camada de hit-testing do Safari ficando velha.
//
// Este painel responde a pergunta que falta: o toque chega na página?
//  - contador sobe e mostra um elemento  -> chega, e o culpado está nomeado
//  - contador não sobe                   -> não chega, é camada do sistema
//
// Fica atrás de `?diag=1` pra não aparecer pra cliente nenhum, e é
// `pointer-events-none` pra não virar ele mesmo o bloqueador.
export default function DiagToques() {
  const [n, setN] = useState(0)
  const [alvo, setAlvo] = useState("—")
  // Ligado DEPOIS da montagem, nunca durante a renderização: ler
  // `window.location` no corpo do componente diverge do que o servidor
  // desenhou, e o React descarta a diferença na hidratação — foi por isso que
  // o painel não apareceu na primeira tentativa.
  const [ligado, setLigado] = useState(false)
  useEffect(() => {
    setLigado(new URLSearchParams(window.location.search).get("diag") === "1")
  }, [])

  useEffect(() => {
    function descreve(el: unknown): string {
      // `instanceof Element` e não truthy: o alvo pode ser `window` ou
      // `document`, e ler `.tagName` deles lança — o erro derrubava o resto
      // do handler DEPOIS de já ter contado o toque.
      if (!(el instanceof Element)) return "nao-elemento"
      const cls = (el.className || "").toString().split(/\s+/).filter(Boolean).slice(0, 3).join(".")
      const z = getComputedStyle(el).zIndex
      return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} z=${z}`
    }
    function onToque(e: TouchEvent | PointerEvent) {
      const p = "touches" in e ? e.touches[0] : e
      if (!p) return
      setN((x) => x + 1)
      // `elementFromPoint` diz quem está POR CIMA naquele ponto — que pode
      // não ser o mesmo que recebeu o evento.
      setAlvo(`${descreve(e.target)} | topo: ${descreve(document.elementFromPoint(p.clientX, p.clientY))}`)
    }
    // Fase de captura: pega o evento antes de qualquer `stopPropagation`.
    window.addEventListener("touchstart", onToque as EventListener, true)
    window.addEventListener("pointerdown", onToque as EventListener, true)
    return () => {
      window.removeEventListener("touchstart", onToque as EventListener, true)
      window.removeEventListener("pointerdown", onToque as EventListener, true)
    }
  }, [])

  if (!ligado) return null

  return (
    <div className="pointer-events-none fixed top-0 left-0 right-0 z-[999] px-2 py-1 text-[10px] leading-tight"
         style={{ background: "rgba(0,0,0,0.85)", color: "#7CFC98", fontFamily: "monospace" }}>
      toques: {n} · {alvo}
    </div>
  )
}
