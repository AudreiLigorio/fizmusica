// Mascote "Fiz" (arara com fones) — ilustrado por encomenda, 4 poses (não geradas
// por nós). Alterna 2 poses num loop simples tipo flipbook, com um leve balanço em
// CSS por cima. Duas variações de humor: "energetic" (dançando) e "calm" (sereno) —
// ver diagnóstico de tom em conversa anterior (ocasiões de celebração vs. sensíveis).
"use client"

type Mood = "energetic" | "calm"

const FRAMES: Record<Mood, [string, string]> = {
  energetic: ["/mascot/fiz-dance-a.webp", "/mascot/fiz-dance-b.webp"],
  calm:      ["/mascot/fiz-calm-a.webp", "/mascot/fiz-calm-b.webp"],
}

// Emoções (lista fixa do wizard, ver CriarClient.tsx) com energia/animação alta —
// combinam com a dança. Tudo que não está aqui (inclusive vazio/desconhecido) cai
// no "calm": é o padrão mais seguro, nunca destoa de um pedido sensível.
const ENERGETIC_EMOTIONS = new Set([
  "☀️ Alegre", "🎉 Divertida", "⚡ Energético", "😤 Agressivo", "💖 Emocionante",
])

export function moodFromEmotion(emotion?: string | null): Mood {
  return emotion && ENERGETIC_EMOTIONS.has(emotion) ? "energetic" : "calm"
}

export default function FizMascot({ mood = "energetic", size = 168 }: { mood?: Mood; size?: number }) {
  const [frameA, frameB] = FRAMES[mood]
  const cycle = mood === "energetic" ? "0.9s" : "1.8s"

  return (
    <div
      className={`fiz-mascot fiz-mascot--${mood}`}
      style={{ width: size, height: size * 1.18, margin: "0 auto", position: "relative", ["--fiz-cycle" as string]: cycle }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={frameA} alt="Mascote Fiz Música" className="fiz-mascot__frame fiz-mascot__frame--a" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={frameB} alt="" aria-hidden="true" className="fiz-mascot__frame fiz-mascot__frame--b" />

      <style jsx>{`
        .fiz-mascot { animation: fiz-bounce var(--fiz-cycle) ease-in-out infinite; }
        .fiz-mascot--calm { animation-name: fiz-bounce-calm; }
        .fiz-mascot__frame {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: contain; object-position: center bottom;
        }
        .fiz-mascot__frame--a { animation: fiz-flip-a var(--fiz-cycle) ease-in-out infinite; }
        .fiz-mascot__frame--b { animation: fiz-flip-b var(--fiz-cycle) ease-in-out infinite; }

        @keyframes fiz-flip-a { 0%, 42% { opacity: 1; } 50%, 100% { opacity: 0; } }
        @keyframes fiz-flip-b { 0%, 42% { opacity: 0; } 50%, 92%, 100% { opacity: 1; } }
        @keyframes fiz-bounce {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-8px) rotate(3deg); }
        }
        @keyframes fiz-bounce-calm {
          0%, 100% { transform: translateY(0) rotate(-1.5deg); }
          50% { transform: translateY(-3px) rotate(1.5deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .fiz-mascot, .fiz-mascot__frame--a, .fiz-mascot__frame--b { animation: none !important; }
          .fiz-mascot__frame--a { opacity: 1; }
          .fiz-mascot__frame--b { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
