"use client"

import { useRouter } from "next/navigation"

export default function Header({
  showButton = true,
}: {
  showButton?: boolean
}) {

  const router = useRouter()

  return (

    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/70 border-b border-white/10">

      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">

        <div className="flex items-center gap-5">

          <img
            src="/logo_fizmusica.png"
            alt="FizMusica"
            className="h-24 w-auto drop-shadow-[0_0_15px_rgba(236,72,153,0.45)] cursor-pointer"
            onClick={() => router.push("/")}
          />

        </div>

        {showButton && (

  <button
    onClick={() => router.push("/criar")}
    className="bg-pink-500 hover:bg-pink-600 transition-all px-7 py-3 rounded-2xl font-semibold shadow-lg shadow-pink-500/20"
  >
    Criar música
  </button>

)}

      </div>

    </header>

  )
}