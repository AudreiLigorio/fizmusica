"use client"

// Campo único da aba Músicas — procura ao mesmo tempo na playlist do cliente
// e na Rede. Quem filtra é cada prateleira; aqui só entra o texto.
export default function BuscaMusicas({
  valor,
  onValor,
  resultados,
}: {
  valor: string
  onValor: (v: string) => void
  // null = nada digitado ainda (não mostra contagem nenhuma)
  resultados: number | null
}) {
  const buscando = !!valor.trim()

  return (
    <div className="mb-5">
      {/* Mesmo par título+linha de apoio do "Rede Fiz Música" (text-xl /
          text-xs): sem ele a tela abria direto num campo e num muro de
          pílulas, sem dizer o que era aquilo nem onde uma seção terminava. */}
      <h2 className="text-xl font-bold">Buscar</h2>
      <p className="text-xs text-white/50 mb-3">Encontre por nome, ocasião ou estilo</p>

      <div className="relative">
        <svg
          viewBox="0 0 24 24" aria-hidden="true"
          className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/35 pointer-events-none"
          fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>

        <input
          type="search"
          value={valor}
          onChange={(e) => onValor(e.target.value)}
          placeholder="Buscar por nome, ocasião, estilo…"
          aria-label="Buscar músicas"
          className="w-full bg-white/[0.05] border border-white/10 rounded-full pl-11 pr-10 py-2.5 text-sm outline-none focus:border-fuchsia-500/50 transition-colors placeholder:text-white/30"
        />

        {buscando && (
          <button
            type="button"
            onClick={() => onValor("")}
            aria-label="Limpar busca"
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 hover:text-white text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {buscando && resultados !== null && (
        <p className="text-[11px] text-white/40 mt-2 px-1">
          {resultados === 0
            ? "Nenhuma música encontrada."
            : `${resultados} música${resultados === 1 ? "" : "s"} encontrada${resultados === 1 ? "" : "s"}.`}
        </p>
      )}
    </div>
  )
}
