"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function Header({ showButton = true, progress }: { showButton?: boolean; progress?: number }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  function go(path: string) {
    setMenuOpen(false)
    router.push(path)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl border-b border-white/[0.06]"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "rgba(7,6,13,0.85)" }}>
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">

        <img
          src="/logo_fizmusica.png"
          alt="Fiz Música"
          className="h-8 w-auto cursor-pointer opacity-90 hover:opacity-100 transition-opacity duration-300"
          onClick={() => router.push("/")}
        />

        <div className="flex items-center gap-4">
          {/* Links desktop */}
          <button
            onClick={() => router.push("/quem-somos")}
            className="hidden md:block text-white/50 hover:text-white/90 transition-colors text-sm font-medium"
          >
            Quem somos
          </button>

          <button
            onClick={() => router.push("/minha-musica")}
            className="hidden md:block text-white/50 hover:text-white/90 transition-colors text-sm font-medium"
          >
            🎵 Minha música
          </button>

          <button
            onClick={() => router.push("/contato")}
            className="hidden md:block text-white/50 hover:text-white/90 transition-colors text-sm font-medium"
          >
            Contato
          </button>

          {showButton && (
            <button
              onClick={() => router.push("/criar")}
              className="text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97] shadow-[0_4px_16px_rgba(240,25,107,0.3)]"
              style={{
                background: "#f0196b",
                fontSize: "0.8125rem",
                fontWeight: 500,
                letterSpacing: "0.04em",
                padding: "0.5rem 1.25rem",
                borderRadius: "0.625rem",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              Criar música
            </button>
          )}

          {/* Botão hambúrguer — só mobile */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden flex flex-col justify-center items-center w-9 h-9 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Menu"
          >
            <span className={`block w-5 h-0.5 bg-white/70 rounded transition-all duration-300 ${menuOpen ? "translate-y-[3px] rotate-45" : ""}`} />
            <span className={`block w-5 h-0.5 bg-white/70 rounded my-[3px] transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-white/70 rounded transition-all duration-300 ${menuOpen ? "-translate-y-[5px] -rotate-45" : ""}`} />
          </button>
        </div>

      </div>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/[0.06]" style={{ background: "rgba(7,6,13,0.97)" }}>
          <nav className="flex flex-col px-6 py-2">
            <button
              onClick={() => go("/minha-musica")}
              className="flex items-center gap-3 text-left text-white/80 hover:text-white py-4 border-b border-white/[0.05] transition-colors"
            >
              <span className="text-lg">🎵</span>
              <span className="font-medium">Minha música</span>
              <span className="ml-auto text-white/30">→</span>
            </button>
            <button
              onClick={() => go("/quem-somos")}
              className="flex items-center gap-3 text-left text-white/80 hover:text-white py-4 border-b border-white/[0.05] transition-colors"
            >
              <span className="text-lg">💜</span>
              <span className="font-medium">Quem somos</span>
              <span className="ml-auto text-white/30">→</span>
            </button>
            <button
              onClick={() => go("/contato")}
              className="flex items-center gap-3 text-left text-white/80 hover:text-white py-4 transition-colors"
            >
              <span className="text-lg">💬</span>
              <span className="font-medium">Contato</span>
              <span className="ml-auto text-white/30">→</span>
            </button>
          </nav>
        </div>
      )}

      {progress !== undefined && (
        <div className="h-[2px] w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, #f0196b, #d946ef)" }}
          />
        </div>
      )}
    </header>
  )
}
