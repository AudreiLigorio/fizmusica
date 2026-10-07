"use client"

import { useEffect, useState } from "react"

// O site está rodando DENTRO do app da Play Store (TWA com.fizmusica.app)?
//
// Existe para a regra de faturamento da Play: conteúdo digital vendido dentro
// do app só pode ser pago pelo Google Play. Até o Play Billing existir, o app
// não vende — o site (navegador) continua vendendo pelo Mercado Pago normal.
//
// Sinal usado: o Android abre o app com `document.referrer` =
// "android-app://com.fizmusica.app/". NÃO usamos `display-mode: standalone`:
// ele também é verdadeiro para quem "instalou" o site pelo Chrome (PWA), que
// não passa pela Play e pode comprar normalmente.
//
// O referrer só vem na primeira página; o flag fica em sessionStorage, que é
// da aba do app — não vaza para o Chrome comum (localStorage vazaria: o app
// compartilha o armazenamento do Chrome).
const CHAVE = "fm_app_play"
const PACOTE = "android-app://com.fizmusica.app"

export function estaNoAppPlay(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (document.referrer.startsWith(PACOTE)) sessionStorage.setItem(CHAVE, "1")
    return sessionStorage.getItem(CHAVE) === "1"
  } catch {
    return document.referrer.startsWith(PACOTE)
  }
}

// Versão para componentes: `null` no servidor e no primeiro render (ainda não
// sabemos — e o HTML tem que bater com o do servidor), valor real logo depois.
// Quem monta pagamento (checkout) tem que ESPERAR o valor: com `false` no
// primeiro render ele montava o Brick e redirecionava antes da detecção.
export function useNoAppPlay(): boolean | null {
  const [noApp, setNoApp] = useState<boolean | null>(null)
  useEffect(() => { setNoApp(estaNoAppPlay()) }, [])
  return noApp
}
