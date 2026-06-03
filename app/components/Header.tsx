"use client"

import { useRouter } from "next/navigation"

export default function Header({ showButton = true, progress }: { showButton?: boolean; progress?: number }) {
  const router = useRouter()

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

      </div>

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
