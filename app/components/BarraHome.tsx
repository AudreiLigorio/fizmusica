"use client"

import { useRouter } from "next/navigation"
import { TabBarMobile, TabsDesktop, type Aba } from "@/app/minha-musica/AreaTabs"

// A mesma barra da área do cliente, agora também na landing — é ela que dá
// caminho de volta pra quem foi parar na Rede e quer entender o produto.
//
// Aparece pra todo mundo, logado ou não: /minha-musica agora tem uma versão
// pro visitante (AreaPublica), então tocar em "Músicas" leva a uma Rede que
// toca de verdade em vez de uma tela travada.
export default function BarraHome() {
  const router = useRouter()

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
