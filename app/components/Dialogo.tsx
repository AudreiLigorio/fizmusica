"use client"

import { useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"

// Confirmação e aviso no visual do site, no lugar de `confirm()`/`alert()`.
// A caixa nativa do navegador ("www.fizmusica.com.br diz…") quebra a
// identidade do app e assusta quem é menos digital — parece erro do celular
// (Audrei, 2026-10-10). Regra: tela de cliente não usa confirm/alert nativo.
//
// API imperativa, igual à nativa, pra trocar sem reescrever o fluxo:
//   if (!(await confirmar({ titulo, mensagem, botao: "Excluir", perigo: true }))) return
//   await avisar({ titulo: "Não deu certo", mensagem: "…" })
// Monta num nó próprio no <body> — não precisa de provider em cada página.
//
// `data-zona-escura`: sempre escuro, como os outros popups (player, Rede),
// pra o tema claro não deixar texto escuro em cartão escuro.

type Opcoes = {
  titulo: string
  mensagem?: string
  botao?: string
  cancelar?: string
  perigo?: boolean
}

function Caixa({ titulo, mensagem, botao = "Confirmar", cancelar, perigo, aoFechar }: Opcoes & { aoFechar: (ok: boolean) => void }) {
  const confirmarRef = useRef<HTMLButtonElement>(null)
  const abertoEm = useRef(Date.now())

  useEffect(() => {
    confirmarRef.current?.focus()
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(false) }
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [aoFechar])

  return (
    <div data-zona-escura role="presentation"
         className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 text-white"
         // Clique logo após abrir é o "fantasma" do toque que abriu a caixa.
         onClick={() => { if (Date.now() - abertoEm.current > 500) aoFechar(false) }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="dialogo-titulo"
           onClick={(e) => e.stopPropagation()}
           className="w-full max-w-sm rounded-3xl border border-white/10 p-6 text-center"
           style={{ background: "#15131d" }}>
        <p id="dialogo-titulo" className="text-lg font-bold">{titulo}</p>
        {mensagem && <p className="text-sm text-white/65 leading-relaxed mt-2">{mensagem}</p>}
        <button
          ref={confirmarRef}
          onClick={() => aoFechar(true)}
          className="w-full mt-6 py-3 rounded-xl text-base font-bold text-white transition-all hover:brightness-110"
          style={{ background: perigo ? "#dc2626" : "linear-gradient(135deg, #f0196b, #d946ef)" }}
        >
          {botao}
        </button>
        {cancelar && (
          <button onClick={() => aoFechar(false)}
                  className="w-full mt-2 py-2.5 rounded-xl text-base text-white/60 hover:text-white transition-colors">
            {cancelar}
          </button>
        )}
      </div>
    </div>
  )
}

function abrir(opcoes: Opcoes): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false)
  return new Promise((resolve) => {
    const no = document.createElement("div")
    document.body.appendChild(no)
    const raiz = createRoot(no)
    let fechado = false
    const aoFechar = (ok: boolean) => {
      if (fechado) return
      fechado = true
      raiz.unmount()
      no.remove()
      resolve(ok)
    }
    raiz.render(<Caixa {...opcoes} aoFechar={aoFechar} />)
  })
}

export function confirmar(opcoes: Opcoes): Promise<boolean> {
  return abrir({ cancelar: "Cancelar", ...opcoes })
}

export async function avisar(opcoes: Omit<Opcoes, "cancelar" | "perigo">): Promise<void> {
  await abrir({ botao: "Entendi", ...opcoes, cancelar: undefined })
}
