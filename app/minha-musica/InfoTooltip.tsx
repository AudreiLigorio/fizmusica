"use client"

import { useState } from "react"

// Bolinha "i" ao lado do título de cada seção — hover no desktop, toque no
// mobile (hover sozinho não existe em touch). blur fecha ao tocar fora.
export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative shrink-0 group">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-label="O que é isso?"
        className="w-5 h-5 rounded-full border border-white/25 text-white/50 text-[11px] font-bold italic flex items-center justify-center hover:border-fuchsia-400/60 hover:text-fuchsia-300 transition-colors"
        style={{ fontFamily: "Georgia, serif" }}
      >
        i
      </button>
      <div
        className={`absolute top-6 right-0 w-52 rounded-lg border border-white/10 bg-[#15111f] p-2.5 text-[11px] leading-relaxed text-white/60 shadow-lg z-10 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        } group-hover:opacity-100 group-hover:pointer-events-auto`}
      >
        {text}
      </div>
    </div>
  )
}
