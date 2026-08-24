"use client"

import { createContext, useCallback, useContext, useRef, useState } from "react"
import { createPortal } from "react-dom"

type ToastState = { message: string; id: number } | null

const ToastCtx = createContext<{ showToast: (message: string) => void } | null>(null)

// Confirmação rápida (2 pontos) pra ações de + e − nas músicas — sem isso o
// cliente clica e não sabe se funcionou (bug real relatado: "cliquei e não
// aconteceu nada"). Portal pro body, senão fica preso atrás do mini player
// (mesma armadilha de stacking context dos outros modais).
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null)
  const idRef = useRef(0)

  const showToast = useCallback((message: string) => {
    const id = ++idRef.current
    setToast({ message, id })
    setTimeout(() => {
      setToast((cur) => (cur?.id === id ? null : cur))
    }, 2200)
  }, [])

  return (
    <ToastCtx.Provider value={{ showToast }}>
      {children}
      {toast &&
        createPortal(
          <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-2.5 rounded-full bg-white text-black text-sm font-semibold shadow-lg animate-fade-in pointer-events-none">
            {toast.message}
          </div>,
          document.body
        )}
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>")
  return ctx
}
