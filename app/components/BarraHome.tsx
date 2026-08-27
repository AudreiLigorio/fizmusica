"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { TabBarMobile, TabsDesktop, type Aba } from "@/app/minha-musica/AreaTabs"

// A mesma barra da área do cliente, agora também na landing — é ela que dá
// caminho de volta pra quem foi parar na Rede e quer entender o produto.
//
// Só aparece pra quem está LOGADO por enquanto: deslogado, /minha-musica
// ainda fica num carregando infinito, então mandar visitante pra lá seria
// pior do que não ter a barra. Abre pra todos quando as telas vazias
// existirem (Fase 3).
export default function BarraHome() {
  const router = useRouter()
  const [logado, setLogado] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setLogado(!!session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setLogado(!!s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!logado) return null

  function ir(a: Aba) {
    if (a === "home") return // já está aqui
    router.push(`/minha-musica?aba=${a}`)
  }

  return (
    <>
      {/* Respiro pra barra fixa não cobrir o fim da página (o rodapé tem os
          links legais — encobri-los não é só questão de estética). */}
      <div className="h-24 sm:h-0" aria-hidden="true" />
      <TabBarMobile aba="home" onAba={ir} onCriar={() => router.push("/criar")} />
    </>
  )
}

// No desktop a barra vira linha no topo — mesma peça, outro formato.
export function TabsHomeDesktop() {
  const router = useRouter()
  const [logado, setLogado] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setLogado(!!session))
  }, [])

  if (!logado) return null

  return (
    <div className="max-w-3xl lg:max-w-5xl mx-auto px-5">
      <TabsDesktop
        aba="home"
        onAba={(a) => { if (a !== "home") router.push(`/minha-musica?aba=${a}`) }}
        onCriar={() => router.push("/criar")}
      />
    </div>
  )
}
