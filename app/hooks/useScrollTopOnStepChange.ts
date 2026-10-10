"use client"

import { useEffect, useRef, type RefObject } from "react"

// Rola pro topo sempre que `key` mudar — pro container com scroll próprio
// (mobile) e pra janela (desktop). Usado em telas com "etapas"/abas trocadas
// por estado em vez de navegação real, onde o Next.js não reseta o scroll
// sozinho (isso só acontece automaticamente em mudanças de rota).
//
// Regra do produto: TODA tela nova começa no topo — começar no meio ou no fim
// confunde quem tem menos familiaridade com o celular.
//
// Por que não é um simples scrollTo suave (era assim, e falhava no celular):
// a pessoa digita a história, toca em "Continuar" e o TECLADO FECHA. A tela
// muda de tamanho no meio da animação, o navegador cancela a rolagem suave e
// a etapa nova aparece parada no meio ou no fim. No computador não há teclado
// virtual, por isso lá sempre funcionou. Então:
//   1. tira o foco do campo (fecha o teclado já),
//   2. pula pro topo SEM animação (nada pra ser cancelado),
//   3. repete depois que a tela termina de se reajustar (teclado fechando no
//      Android/iOS leva ~300ms e às vezes devolve a rolagem antiga).
export function useScrollTopOnStepChange(key: unknown, containerRef?: RefObject<HTMLElement | null>) {
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }

    const ativo = document.activeElement
    if (ativo instanceof HTMLElement && ativo !== document.body) ativo.blur()

    const topo = () => {
      const c = containerRef?.current
      if (c) c.scrollTop = 0
      window.scrollTo(0, 0)
    }
    topo()
    const quadro = requestAnimationFrame(topo)
    const depoisDoTeclado = setTimeout(topo, 350)

    // Teclado fechando redimensiona a área visível: quando isso acontecer
    // logo após a troca, garante o topo de novo.
    const vv = window.visualViewport
    const aoRedimensionar = () => topo()
    vv?.addEventListener("resize", aoRedimensionar)
    const pararDeOuvir = setTimeout(() => vv?.removeEventListener("resize", aoRedimensionar), 800)

    return () => {
      cancelAnimationFrame(quadro)
      clearTimeout(depoisDoTeclado)
      clearTimeout(pararDeOuvir)
      vv?.removeEventListener("resize", aoRedimensionar)
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
