"use client"

const STEPS = [
  { n: 1, label: "História"  },
  { n: 2, label: "Fotos"     },
  { n: 3, label: "Produto"   },
  { n: 4, label: "Pagamento" },
  { n: 5, label: "Pronto"    },
] as const

type JourneyStep = 1 | 2 | 3 | 4 | 5

export default function JourneyProgress({ current }: { current: JourneyStep }) {
  return (
    <div className="flex items-start justify-center py-4 px-3">
      {STEPS.map((step, i) => {
        const done   = step.n < current
        const active = step.n === current
        // Enquanto o cliente está na História (passo 1), destaca "Fotos" com um ícone
        // piscando — evidencia a possibilidade de incluir fotos antes que ele chegue lá.
        const spotlightFotos = current === 1 && step.label === "Fotos"

        return (
          <div key={step.n} className="flex items-start">
            {/* Step */}
            <div className="flex flex-col items-center" style={{ minWidth: 46 }}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                done   ? "text-white" :
                active ? "text-white animate-pulse-ring" :
                spotlightFotos ? "border text-pink-400 animate-icon-ping" :
                         "border border-white/12 bg-white/[0.03] text-white/30"
              }`} style={
                done || active ? { background: "var(--pink)" } :
                spotlightFotos ? { borderColor: "rgba(240,25,107,0.5)" } : undefined
              }>
                {done ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : spotlightFotos ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                ) : step.n}
              </div>
              <span className={`text-[10px] mt-2 text-center leading-tight transition-all ${
                active ? "font-semibold text-white" :
                done   ? "font-medium text-white/55" :
                spotlightFotos ? "font-medium text-pink-300" :
                         "text-white/30"
              }`} style={{ maxWidth: 52 }}>
                {step.label}
              </span>
            </div>

            {/* Conector */}
            {i < STEPS.length - 1 && (
              <div className="h-[2px] mt-[13px] mx-1 rounded-full transition-all" style={{
                minWidth: 24,
                flex: 1,
                background: done ? "var(--pink)" : "rgba(255,255,255,0.08)"
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
