"use client"

// Datas especiais e Indique amigos precisam aparecer nas três abas, mas
// repetir o card inteiro 3× deixaria toda aba longa e com cara de insistência.
// Aqui vai a versão de uma linha (Pedidos e Músicas); a completa vive na
// Carreira, pra onde estes atalhos levam.
export default function FaixaAtalhos({ onIr }: { onIr: () => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
      <Atalho
        onClick={onIr}
        titulo="Datas especiais"
        desc="Nunca esqueça um aniversário"
        icon={
          <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </>
        }
      />
      <Atalho
        onClick={onIr}
        titulo="Indique amigos"
        desc="Compartilhe e ganhe bônus"
        icon={
          <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M19 8v6M22 11h-6" />
          </>
        }
      />
    </div>
  )
}

function Atalho({ titulo, desc, icon, onClick }: { titulo: string; desc: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:border-fuchsia-500/40 hover:bg-white/[0.05] transition-colors"
    >
      <svg
        viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-fuchsia-300"
        fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      >
        {icon}
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold truncate">{titulo}</span>
        <span className="block text-[11px] text-white/40 truncate">{desc}</span>
      </span>
      <span className="text-white/30 text-sm shrink-0">→</span>
    </button>
  )
}
