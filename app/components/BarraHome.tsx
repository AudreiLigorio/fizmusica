"use client"

import { useRouter, usePathname } from "next/navigation"
import { TabBarMobile, TabsDesktop, type Aba } from "@/app/minha-musica/AreaTabs"

// A mesma barra da área do cliente, agora também na landing e nas páginas
// institucionais (Quem somos, Contato) — pedido do Audrei: clicar num link do
// menu não pode fazer esse rodapé desaparecer, senão vira ida sem volta fácil.
//
// Aparece pra todo mundo, logado ou não: /minha-musica agora tem uma versão
// pro visitante (AreaPublica), então tocar em "Músicas" leva a uma Rede que
// toca de verdade em vez de uma tela travada.
export default function BarraHome() {
  const router = useRouter()
  const pathname = usePathname()
  // Só a Home propriamente dita acende o ícone Home — nas outras páginas que
  // montam esta barra (Quem somos, Contato) nenhuma das 4 abas representa
  // onde a pessoa está, então nenhuma acende.
  const aba: Aba | null = pathname === "/" ? "home" : null

  function ir(a: Aba) {
    // Antes assumia que "home" clicado só podia significar "já está na
    // Home" (por só existir ali). Agora a barra também vive em Quem
    // somos/Contato, então precisa navegar de verdade.
    if (a === "home") { if (pathname !== "/") router.push("/"); return }
    router.push(`/minha-musica?aba=${a}`)
  }

  return (
    <>
      {/* Respiro pra barra fixa não cobrir o fim da página (o rodapé tem os
          links legais — encobri-los não é só questão de estética). */}
      <div className="h-24 sm:h-0" aria-hidden="true" />
      <TabBarMobile aba={aba} onAba={ir} onCriar={() => router.push("/criar")} />
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
