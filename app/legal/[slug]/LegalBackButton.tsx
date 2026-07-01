"use client"

import { useRouter } from "next/navigation"

// Volta para a tela de origem (a que o cliente estava antes de abrir o documento).
// Como os links de termos abrem na mesma aba, o histórico do navegador funciona —
// e o estado da tela anterior (wizard/checkout) é restaurado via bfcache.
export default function LegalBackButton() {
  const router = useRouter()

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back()
    else router.push("/")
  }

  return (
    <button onClick={handleBack} className="text-pink-400 hover:text-pink-300 text-sm">
      ← Voltar
    </button>
  )
}
