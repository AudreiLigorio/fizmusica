import Link from "next/link"
import { createServerClient } from "@/lib/supabase"
import AgoraBox from "./AgoraBox"

export const dynamic = "force-dynamic"

// Comportamento no site: de onde a visita veio e até onde ela foi. Junta o que
// já existia solto — cliques nos links dos posts, sessões do wizard — com os
// eventos novos, numa leitura só: onde as pessoas param.
//
// 24/11/2026 — três correções:
// 1. A página lia UMA consulta com `.limit(20000)`, mas a API do Supabase
//    devolve no máximo 1.000 linhas por vez. Com 14 mil eventos em 30 dias, o
//    funil mostrava 335 visitas e 1 refrão quando eram 707 e 14. Agora lê em
//    páginas e deixa os `ping` de fora (são ~70% das linhas e o funil não usa).
// 2. Testes (origem que começa com "teste", e a verificação do Claude) saem
//    de tudo.
// 3. "Clicaram em criar música" saiu do funil: o anúncio leva DIRETO ao
//    wizard, então o degrau dava 0 com 58 pessoas no degrau seguinte. No lugar
//    entrou "Passaram da 1ª tela", que é onde o anúncio trava.
// 4. "Onde param" somava anúncio e direto e chamava de "parou" quem chegou no
//    passo 5 e PAGOU. Virou "Até onde foram", com o nome de cada passo, as
//    duas origens em colunas e, no passo 5, quantos viram o refrão e pagaram.
//    Sessões vindas de localhost (teste local grava no banco de produção)
//    saem junto com os testes.

type Evento = {
  sessao: string
  evento: string
  detalhe: string | null
  utm_source: string | null
  utm_campaign: string | null
  utm_content: string | null
  referrer: string | null
  caminho: string | null
  created_at: string
}

const PERIODOS = [
  { dias: 1, rotulo: "24 h" },
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
]

const ehTeste = (e: Evento) =>
  /^teste/i.test(e.utm_source ?? "") || /^teste|verificacao/i.test(e.utm_content ?? "") ||
  /^(localhost|127\.0\.0\.1)$/.test(e.referrer ?? "")

// Os 5 passos do wizard (mesma ordem de ETAPAS_WIZARD em app/criar/CriarClient.tsx).
const NOMES_PASSO = ["Ocasião", "Sua história", "Estilo", "Seus dados", "Prévia da letra e pagamento"]

const passoDe = (e: Evento) =>
  e.evento === "wizard_passo" && e.detalhe ? Number(e.detalhe.replace("passo-", "")) || 0 : 0

// Degraus do funil, por sessão.
const DEGRAUS: { rotulo: string; bate: (e: Evento) => boolean }[] = [
  { rotulo: "Visitaram o site", bate: (e) => e.evento === "pageview" },
  { rotulo: "Entraram no wizard", bate: (e) => e.evento === "wizard_passo" },
  { rotulo: "Passaram da 1ª tela", bate: (e) => passoDe(e) >= 2 },
  // `detalhe` restringe a quem realmente VIU o refrão: o mesmo evento também é
  // emitido quando a prévia falha ou bate no teto.
  { rotulo: "Viram o refrão da música", bate: (e) => e.evento === "previa_letra" && e.detalhe === "revelada" },
  { rotulo: "Chegaram no pagamento", bate: (e) => e.evento === "checkout" },
  { rotulo: "Pagaram", bate: (e) => e.evento === "pago" },
]

function pct(n: number, de: number) {
  if (!de || !n) return ""
  const p = (n / de) * 100
  return `${p < 10 ? p.toFixed(1).replace(".", ",") : p.toFixed(0)}%`
}

function mediana(v: number[]) {
  if (!v.length) return null
  const o = [...v].sort((a, b) => a - b)
  return o[Math.floor(o.length / 2)]
}

export default async function ComportamentoPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias: diasParam } = await searchParams
  const dias = PERIODOS.some((p) => String(p.dias) === diasParam) ? Number(diasParam) : 30
  const supabase = createServerClient()
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

  // Em páginas de 1.000 (teto da API), ordenado por id pra não pular nem
  // repetir linha entre uma página e outra.
  const todos: Evento[] = []
  for (let de = 0; de < 100_000; de += 1000) {
    const { data, error } = await supabase
      .from("site_events")
      .select("sessao, evento, detalhe, utm_source, utm_campaign, utm_content, referrer, caminho, created_at")
      .gte("created_at", desde)
      .neq("evento", "ping")
      .order("id", { ascending: true })
      .range(de, de + 999)
    if (error || !data?.length) break
    for (const e of data as Evento[]) if (!ehTeste(e)) todos.push(e)
    if (data.length < 1000) break
  }

  // Por sessão: o que ela fez, de onde veio (1º toque) e quanto ficou.
  type Sessao = { origem: string; campanha: string | null; degraus: Set<number>; passoMax: number; saida: number | null; ouviu: boolean }
  const sessoes = new Map<string, Sessao>()
  for (const e of todos) {
    let s = sessoes.get(e.sessao)
    if (!s) {
      s = {
        origem: e.utm_source || "direto/orgânico",
        campanha: e.utm_source ? (e.utm_content || e.utm_campaign || e.utm_source) : null,
        degraus: new Set(),
        passoMax: 0,
        saida: null,
        ouviu: false,
      }
      sessoes.set(e.sessao, s)
    }
    DEGRAUS.forEach((d, i) => { if (d.bate(e)) s.degraus.add(i) })
    s.passoMax = Math.max(s.passoMax, passoDe(e))
    // 1ª saída da sessão: "12s 40%" → 12. É o tempo da primeira visita.
    if (e.evento === "saida" && s.saida === null && e.detalhe) {
      const seg = parseInt(e.detalhe, 10)
      if (Number.isFinite(seg)) s.saida = seg
    }
    if (e.evento === "recepcao" && /ouvir|exemplo_pamela/.test(e.detalhe ?? "")) s.ouviu = true
  }
  const lista = [...sessoes.values()]

  const funil = DEGRAUS.map((d, i) => ({ rotulo: d.rotulo, sessoes: lista.filter((s) => s.degraus.has(i)).length }))
  const topo = funil[0].sessoes || 1

  // Até onde cada pessoa foi no wizard, separando quem veio de link com
  // campanha (anúncio, bio) de quem veio direto. No passo 5, "foi até aqui"
  // inclui quem pagou — por isso ele mostra o refrão e o pagamento à parte.
  const IREFRAO = DEGRAUS.findIndex((d) => d.rotulo.startsWith("Viram o refrão"))
  const IPAGO = DEGRAUS.length - 1
  const ateOnde = NOMES_PASSO.map((nome, i) => {
    const aqui = lista.filter((s) => s.passoMax === i + 1)
    return {
      passo: i + 1,
      nome,
      campanha: aqui.filter((s) => s.campanha).length,
      direto: aqui.filter((s) => !s.campanha).length,
      refrao: aqui.filter((s) => s.degraus.has(IREFRAO)).length,
      pagaram: aqui.filter((s) => s.degraus.has(IPAGO)).length,
    }
  })
  const noWizard = ateOnde.reduce((t, l) => t + l.campanha + l.direto, 0)

  const porOrigem = new Map<string, number>()
  for (const s of lista) porOrigem.set(s.origem, (porOrigem.get(s.origem) ?? 0) + 1)

  // Por campanha (utm_content; anúncio antigo sem nome aparece pelo id).
  type Linha = { nome: string; origem: string; n: number; d: number[]; saidas: number[]; ouviram: number }
  const porCampanha = new Map<string, Linha>()
  for (const s of lista) {
    if (!s.campanha) continue
    const l = porCampanha.get(s.campanha) ?? { nome: s.campanha, origem: s.origem, n: 0, d: DEGRAUS.map(() => 0), saidas: [], ouviram: 0 }
    l.n++
    s.degraus.forEach((i) => l.d[i]++)
    if (s.saida !== null) l.saidas.push(s.saida)
    if (s.ouviu) l.ouviram++
    porCampanha.set(s.campanha, l)
  }
  const campanhas = [...porCampanha.values()].sort((a, b) => b.n - a.n).slice(0, 12)

  const porPagina = new Map<string, number>()
  for (const e of todos) {
    if (e.evento !== "pageview" || !e.caminho) continue
    porPagina.set(e.caminho, (porPagina.get(e.caminho) ?? 0) + 1)
  }

  const ord = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <div className="p-4 lg:p-8 max-w-5xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Comportamento no site</h1>
      <p className="text-gray-500 text-sm mb-4">
        Contagem por pessoa (sessão anônima), não por clique — e sem IP, sem identificação: serve pra
        saber onde a jornada trava, não quem é quem. Testes ficam de fora.
      </p>

      <div className="flex gap-2 mb-8">
        {PERIODOS.map((p) => (
          <Link key={p.dias} href={`/admin/comportamento?dias=${p.dias}`}
                className={`text-sm rounded-full px-3.5 py-1.5 border ${p.dias === dias ? "border-pink-500 bg-pink-500/15 text-white" : "border-white/10 text-white/60 hover:text-white"}`}>
            {p.rotulo}
          </Link>
        ))}
      </div>

      <AgoraBox />

      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-6">
        <h2 className="text-white/80 text-sm font-semibold mb-4">Funil</h2>
        {lista.length === 0 ? (
          <p className="text-white/40 text-sm">Nenhuma visita no período.</p>
        ) : (
          <div className="space-y-2">
            {funil.map((p) => {
              const largura = (p.sessoes / topo) * 100
              return (
                <div key={p.rotulo}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/70">{p.rotulo}</span>
                    <span className="text-white/50">
                      {p.sessoes} {p.sessoes > 0 && <span className="text-white/30">· {pct(p.sessoes, topo)}</span>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.max(largura, p.sessoes ? 2 : 0)}%`, background: "linear-gradient(90deg,#f0196b,#d946ef)" }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 mb-6">
        <h2 className="text-white/80 text-sm font-semibold mb-1">Por campanha</h2>
        <p className="text-white/40 text-[12px] mb-4">
          Pelo utm_content do link (anúncio sem nome aparece pelo número). % sobre as visitas da
          própria campanha. &quot;Ficou&quot; = mediana de segundos até sair, medida desde 24/11 18h15.
        </p>
        {campanhas.length === 0 ? (
          <p className="text-white/40 text-[13px]">Nenhuma visita de campanha no período.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-[13px] min-w-[640px]">
              <thead>
                <tr className="text-white/40 text-left">
                  <th className="font-normal px-2 pb-2">Campanha</th>
                  <th className="font-normal px-2 pb-2 text-right">Visitas</th>
                  <th className="font-normal px-2 pb-2 text-right">Wizard</th>
                  <th className="font-normal px-2 pb-2 text-right">Passou da 1ª</th>
                  <th className="font-normal px-2 pb-2 text-right">Refrão</th>
                  <th className="font-normal px-2 pb-2 text-right">Pagamento</th>
                  <th className="font-normal px-2 pb-2 text-right">Pagaram</th>
                  <th className="font-normal px-2 pb-2 text-right">Ouviram exemplo</th>
                  <th className="font-normal px-2 pb-2 text-right">Ficou</th>
                </tr>
              </thead>
              <tbody>
                {campanhas.map((c) => {
                  const m = mediana(c.saidas)
                  return (
                    <tr key={c.nome} className="border-t border-white/5">
                      <td className="px-2 py-2 text-white/80">
                        <span className="block max-w-[180px] truncate" title={c.nome}>{c.nome}</span>
                        <span className="text-white/35 text-[11px]">{c.origem}</span>
                      </td>
                      <td className="px-2 py-2 text-right text-white/80">{c.n}</td>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <td key={i} className="px-2 py-2 text-right text-white/70">
                          {c.d[i]} <span className="text-white/30">{pct(c.d[i], c.n)}</span>
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right text-white/70">
                        {c.ouviram} <span className="text-white/30">{pct(c.ouviram, c.n)}</span>
                      </td>
                      <td className="px-2 py-2 text-right text-white/70">
                        {m === null ? "—" : `${m}s`}
                        {c.saidas.length > 0 && <span className="block text-white/30 text-[11px]">{c.saidas.length} medidas</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
          <h2 className="text-white/80 text-sm font-semibold mb-1">Até onde foram no wizard</h2>
          <p className="text-white/40 text-[12px] mb-3">
            Cada pessoa conta uma vez, no passo mais longe que alcançou. Todas as origens; o anúncio sozinho está em &quot;Por campanha&quot;.
          </p>
          {noWizard === 0 ? (
            <p className="text-white/40 text-[13px]">Ninguém entrou no wizard no período.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-white/40 text-left">
                  <th className="font-normal pb-1.5">Passo</th>
                  <th className="font-normal pb-1.5 text-right">De campanha</th>
                  <th className="font-normal pb-1.5 text-right">Direto</th>
                </tr>
              </thead>
              <tbody>
                {ateOnde.map((l) => (
                  <tr key={l.passo} className="border-t border-white/5 align-top">
                    <td className="py-1.5 text-white/70">
                      {l.passo}. {l.nome}
                      {l.passo === 5 && l.campanha + l.direto > 0 && (
                        <span className="block text-[12px] text-white/40">
                          {l.refrao} viram o refrão · {l.pagaram} pagaram
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-white/60">{l.campanha || "–"}</td>
                    <td className="py-1.5 text-right text-white/60">{l.direto || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <p className="text-white/40 text-[13px]">Sem visualizações no período.</p>
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
