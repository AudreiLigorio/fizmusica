"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter } from "next/navigation"
import { useNoAppPlay } from "@/lib/canal"
import { track } from "@/lib/track"
import type { DestinoOnboarding } from "./OnboardingApp"

// Decide se o onboarding aparece. Mora no layout, mas é leve: as telas
// (OnboardingApp + motor + CSS) só são baixadas quando vão aparecer.
//
// Regras:
//  - só no app Android (canal Play) — o site não tem onboarding;
//  - só na primeira vez que o app abre (marca em localStorage);
//  - nunca por cima de um link de música (/m/ presente, /rede/ pública):
//    quem chegou por um link quer ouvir aquela música primeiro;
//  - reabre a qualquer hora pelo "Como funciona" do menu (evento abaixo).
const OnboardingApp = dynamic(() => import("./OnboardingApp"), { ssr: false })

export const CHAVE_ONBOARDING = "fm_onboarding_visto"
export const EVENTO_ABRIR_ONBOARDING = "fm-onboarding-abrir"

export default function OnboardingPortao() {
  const noApp = useNoAppPlay()
  const pathname = usePathname()
  const router = useRouter()
  // Fechado nesta visita (depois de concluir/pular) e aberto à mão (menu).
  const [fechado, setFechado] = useState(false)
  const [manual, setManual] = useState(false)

  useEffect(() => {
    const abrir = () => { setFechado(false); setManual(true) }
    window.addEventListener(EVENTO_ABRIR_ONBOARDING, abrir)
    return () => window.removeEventListener(EVENTO_ABRIR_ONBOARDING, abrir)
  }, [])

  // `noApp` só vira true no navegador, depois de montar — então ler o
  // localStorage aqui não diverge do HTML do servidor.
  const caminhoLivre = !/^\/(m|rede)\//.test(pathname) && !pathname.startsWith("/admin")
  let visto = false
  if (noApp === true) {
    try { visto = localStorage.getItem(CHAVE_ONBOARDING) === "1" } catch { /* sem storage: mostra */ }
  }
  const aberto = manual || (!fechado && noApp === true && caminhoLivre && !visto)

  if (!aberto) return null

  function fechar(destino: DestinoOnboarding) {
    try { localStorage.setItem(CHAVE_ONBOARDING, "1") } catch { /* vale só nesta visita */ }
    track("onboarding_fim", destino)
    setFechado(true); setManual(false)
    if (destino === "criar") router.push("/criar")
    else if (destino === "spotfiz") router.push("/minha-musica?aba=musicas")
  }

  return <OnboardingApp onFechar={fechar} />
}
