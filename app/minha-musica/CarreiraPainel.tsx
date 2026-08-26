"use client"

// Cabeçalho da aba Carreira: quem é o cliente e onde vai crescer.
//
// O bloco de nível/discos aparece travado de propósito. O programa de
// fidelidade está especificado mas não construído — e prometer com número
// falso seria pior do que dizer que ainda não chegou.
export default function CarreiraPainel({ nome, email }: { nome: string; email: string }) {
  const inicial = (nome || email || "?").trim().charAt(0).toUpperCase()

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6" style={{ borderLeft: "3px solid #d946ef" }}>
      <div className="flex items-center gap-3.5 mb-5">
        {/* Vira o personagem do cliente quando a fidelidade existir — os 5
            níveis de cantor já têm arte pronta. */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0"
          style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)" }}
          aria-hidden="true"
        >
          {inicial}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-base truncate">{nome}</p>
          <p className="text-xs text-white/45 truncate">{email}</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-white/12 bg-black/20 px-4 py-3.5">
        <div className="flex items-center gap-2 mb-1">
          <svg
            viewBox="0 0 24 24" className="w-4 h-4 text-white/30 shrink-0" aria-hidden="true"
            fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="12" cy="9" r="6" />
            <path d="M8.2 14.3 7 22l5-3 5 3-1.2-7.7" />
          </svg>
          <p className="text-xs font-semibold text-white/60">Seu nível de cantor</p>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-white/30 border border-white/12 rounded-full px-2 py-0.5 shrink-0">
            Em breve
          </span>
        </div>
        <p className="text-[11px] text-white/35 leading-relaxed">
          Cada música criada e cada amigo indicado vão virar pontos aqui — com
          personagem que evolui conforme você sobe de nível.
        </p>
      </div>
    </div>
  )
}
