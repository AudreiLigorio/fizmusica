"use client"

import { useEffect, useRef } from "react"

/**
 * Conta uma visita ao player, do lado do navegador.
 *
 * A contagem morava na própria página, no servidor. Com a página cacheada
 * (`revalidate`), aquele trecho só rodaria quando o cache fosse renovado — o
 * número cairia para quase zero e pareceria que ninguém abre os links.
 *
 * Fazer daqui tem um custo honesto: quem bloqueia script não é contado. Em
 * troca, a página deixa de custar uma invocação de função por abertura, que é
 * o que pausou o projeto na Vercel em 04/11. O aviso é minúsculo e não bloqueia
 * nada na tela.
 *
 * `sendBeacon` em vez de `fetch`: ele sobrevive a quem abre o link e fecha a
 * aba em seguida, que é metade dos casos num link compartilhado por WhatsApp.
 */
export default function ContarVisita({ slug }: { slug: string }) {
  const jaContou = useRef(false)

  useEffect(() => {
    // O React 18+ monta duas vezes em desenvolvimento, e a navegação do app
    // pode remontar o componente. Sem esta trava, uma abertura viraria duas.
    if (jaContou.current) return
    jaContou.current = true

    const url = `/api/m/visita?slug=${encodeURIComponent(slug)}`
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(url)
      else void fetch(url, { method: "POST", keepalive: true })
    } catch {
      // Contagem é métrica interna: falhar aqui não pode afetar quem está
      // ouvindo a música.
    }
  }, [slug])

  return null
}
