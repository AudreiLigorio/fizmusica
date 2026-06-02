"use client"

import { useRouter } from "next/navigation"

export default function Header({ showButton = true, progress }: { showButton?: boolean; progress?: number }) {
  const router = useRouter()

  return (
    <header className="fixed top-0 left-0 right-0 z-50" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="px-5 pt-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between backdrop-blur-2xl bg-[#07060d]/70 border border-white/[0.07] rounded-2xl px-6 py-3.5 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">

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
          <div className="max-w-6xl mx-auto mt-2 h-[2px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #f0196b, #d946ef)" }}
            />
          </div>
        )}
      </div>
    </header>
  )
}
