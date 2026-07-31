import { createServerClient } from "@/lib/supabase"
import AgoraBox from "./AgoraBox"

export const dynamic = "force-dynamic"

// Comportamento no site: de onde a visita veio e até onde ela foi. Junta o que
// já existia solto — cliques nos links dos posts, sessões do wizard — com os
// eventos novos, numa leitura só: onde as pessoas param.

const PASSOS = [
  { evento: "pageview", rotulo: "Visitaram o site" },
  { evento: "cta_criar", rotulo: "Clicaram em criar música" },
  { evento: "wizard_passo", rotulo: "Entraram no wizard" },
  { evento: "checkout", rotulo: "Chegaram no pagamento" },
  { evento: "pago", rotulo: "Pagaram" },
]

export default async function ComportamentoPage() {
  const supabase = createServerClient()
  const trintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: eventos } = await supabase
    .from("site_events")
    .select("sessao, evento, detalhe, utm_source, utm_campaign, caminho, created_at")
    .gte("created_at", trintaDias)
    .limit(20000)

  const todos = eventos ?? []

  // Funil por SESSÃO, não por evento: o que importa é quantas pessoas
  // chegaram até cada degrau, não quantas vezes o degrau foi pisado.
  const sessoesPor = (evento: string) => new Set(todos.filter((e) => e.evento === evento).map((e) => e.sessao))
  const funil = PASSOS.map((p) => ({ ...p, sessoes: sessoesPor(p.evento).size }))
  const topo = funil[0].sessoes || 1

  // Onde o wizard trava: última etapa alcançada por sessão.
  const ultimoPasso = new Map<string, number>()
  for (const e of todos) {
    if (e.evento !== "wizard_passo" || !e.detalhe) continue
    const n = Number(e.detalhe.replace("passo-", ""))
    if (Number.isFinite(n)) ultimoPasso.set(e.sessao, Math.max(ultimoPasso.get(e.sessao) ?? 0, n))
  }
  const paradaPorPasso = new Map<number, number>()
  for (const n of ultimoPasso.values()) paradaPorPasso.set(n, (paradaPorPasso.get(n) ?? 0) + 1)

  // Origem por sessão (primeiro toque).
  const origemPorSessao = new Map<string, string>()
  for (const e of todos) {
    if (!origemPorSessao.has(e.sessao)) origemPorSessao.set(e.sessao, e.utm_source || "direto/orgânico")
  }
  const porOrigem = new Map<string, number>()
  for (const o of origemPorSessao.values()) porOrigem.set(o, (porOrigem.get(o) ?? 0) + 1)

  // Páginas mais vistas.
  const porPagina = new Map<string, number>()
  for (const e of todos) {
    if (e.evento !== "pageview" || !e.caminho) continue
    porPagina.set(e.caminho, (porPagina.get(e.caminho) ?? 0) + 1)
  }

  const ord = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <div className="p-4 lg:p-8 max-w-5xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Comportamento no site</h1>
      <p className="text-gray-500 text-sm mb-8">
        Últimos 30 dias. Contagem por pessoa (sessão anônima), não por clique — e sem IP, sem
        identificação: serve pra saber onde a jornada trava, não quem é quem.
      </p>

      <AgoraBox />

      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-6">
        <h2 className="text-white/80 text-sm font-semibold mb-4">Funil</h2>
        {todos.length === 0 ? (
          <p className="text-white/40 text-sm">
            Nada ainda — a coleta começa no próximo acesso ao site.
          </p>
        ) : (
          <div className="space-y-2">
            {funil.map((p) => {
              const pct = (p.sessoes / topo) * 100
              return (
                <div key={p.evento}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/70">{p.rotulo}</span>
                    <span className="text-white/50">
                      {p.sessoes} {p.sessoes > 0 && <span className="text-white/30">· {pct.toFixed(0)}%</span>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.max(pct, p.sessoes ? 2 : 0)}%`, background: "linear-gradient(90deg,#f0196b,#d946ef)" }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
          <h2 className="text-white/80 text-sm font-semibold mb-3">Onde param no wizard</h2>
          {paradaPorPasso.size === 0 ? (
            <p className="text-white/40 text-[13px]">Ninguém entrou no wizard ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {[...paradaPorPasso.entries()].sort((a, b) => a[0] - b[0]).map(([passo, qtd]) => (
                <li key={passo} className="flex justify-between text-[13px]">
                  <span className="text-white/70">Passo {passo}</span>
                  <span className="text-white/50">{qtd} pararam aqui</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-white/30 text-[11px] mt-3">
            Concentração num passo é sinal de confusão ou de pedido demais naquela tela.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
          <h2 className="text-white/80 text-sm font-semibold mb-3">De onde vêm</h2>
          {porOrigem.size === 0 ? (
            <p className="text-white/40 text-[13px]">Sem visitas registradas.</p>
          ) : (
            <ul className="space-y-1.5">
              {ord(porOrigem).map(([origem, qtd]) => (
                <li key={origem} className="flex justify-between text-[13px]">
                  <span className="text-white/70">{origem}</span>
                  <span className="text-white/50">{qtd}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 md:col-span-2">
          <h2 className="text-white/80 text-sm font-semibold mb-3">Páginas mais vistas</h2>
          {porPagina.size === 0 ? (
            <p className="text-white/40 text-[13px]">Sem visualizações ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {ord(porPagina).map(([pagina, qtd]) => (
                <li key={pagina} className="flex justify-between text-[13px]">
                  <code className="text-white/70">{pagina}</code>
                  <span className="text-white/50">{qtd}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
