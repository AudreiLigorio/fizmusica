"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { CHAVE_TEMA, EVENTO_TEMA, PREFIXOS_SEMPRE_ESCUROS, TEMA_PADRAO, type Tema } from "@/lib/tema"
import { estaNoAppPlay, useNoAppPlay } from "@/lib/canal"

// Aparência escolhida pelo cliente. O tema claro vive em app/globals.css, sob
// [data-tema="claro"] no <html> — vale para o site inteiro, INCLUSIVE o topo
// (web) e a barra de abas (celular), para os menus terem a mesma cor em toda
// página. O primeiro valor é aplicado pelo script do <head> (layout); este
// componente mantém em dia ao navegar, ao trocar no interruptor e quando o
// celular muda sozinho de claro para escuro (modo Automático).

export function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE_TEMA)
    if (t === "claro" || t === "escuro" || t === "auto") return t
  } catch { /* sem storage: padrão */ }
  return TEMA_PADRAO
}

function escolherTema(t: Tema) {
  try { localStorage.setItem(CHAVE_TEMA, t) } catch { /* a escolha vale só nesta visita */ }
  window.dispatchEvent(new Event(EVENTO_TEMA))
}

function deveSerClaro(pathname: string): boolean {
  if (PREFIXOS_SEMPRE_ESCUROS.some((p) => pathname.startsWith(p))) return false
  // No app da Play: sempre escuro, ignore o que estiver salvo (o app
  // compartilha o localStorage com o Chrome do celular).
  if (estaNoAppPlay()) return false
  const t = lerTema()
  if (t !== "auto") return t === "claro"
  return !window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function SincronizarTema() {
  const pathname = usePathname()
  useEffect(() => {
    const aplicar = () => {
      if (deveSerClaro(pathname)) document.documentElement.dataset.tema = "claro"
      else delete document.documentElement.dataset.tema
    }
    aplicar()
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    window.addEventListener(EVENTO_TEMA, aplicar)
    mq.addEventListener("change", aplicar)
    return () => { window.removeEventListener(EVENTO_TEMA, aplicar); mq.removeEventListener("change", aplicar) }
  }, [pathname])
  return null
}

// Interruptor de três posições. `compacto` = só ícones (topo do computador).
export function SeletorTema({ compacto = false }: { compacto?: boolean }) {
  const noApp = useNoAppPlay()
  const [tema, setTema] = useState<Tema>(TEMA_PADRAO)
  useEffect(() => {
    setTema(lerTema())
    const ouvir = () => setTema(lerTema())
    window.addEventListener(EVENTO_TEMA, ouvir)
    return () => window.removeEventListener(EVENTO_TEMA, ouvir)
  }, [])

  // No app não há escolha (sempre escuro). `null` = ainda detectando: some
  // também, para não piscar o seletor dentro do app.
  if (noApp !== false) return null

  const opcoes: { id: Tema; icone: string; rotulo: string }[] = [
    { id: "claro", icone: "☀️", rotulo: "Claro" },
    { id: "escuro", icone: "🌙", rotulo: "Escuro" },
    { id: "auto", icone: "📱", rotulo: "Automático" },
  ]

  return (
    <div role="radiogroup" aria-label="Aparência do site"
         className="inline-flex items-center gap-1 rounded-full p-1 border border-white/15 bg-white/5">
      {opcoes.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={tema === o.id}
          title={o.rotulo}
          onClick={() => escolherTema(o.id)}
          // Cor da opção ativa em style: vence as regras do tema claro (que
          // trocam text-white por escuro) e fica igual nos dois temas.
          style={tema === o.id ? { background: "#c2185b", color: "#ffffff" } : undefined}
          className={`rounded-full text-xs font-medium transition-colors ${compacto ? "w-8 h-8" : "px-3 py-1.5"} ${
            tema === o.id ? "" : "text-white/70 hover:text-white"
          }`}
        >
          <span aria-hidden="true">{o.icone}</span>{!compacto && <span className="ml-1.5">{o.rotulo}</span>}
        </button>
      ))}
    </div>
  )
}
