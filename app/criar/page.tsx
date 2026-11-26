import { connection } from "next/server"
import CriarClient, { type PlanoResumo } from "./CriarClient"
import { getWizardOccasions, type WizardOccasion } from "@/lib/wizard"
import { createServerClient } from "@/lib/supabase"

// Renderização POR PEDIDO, de propósito (25/11/2026). Pré-renderizada, a
// página chegava com o <body> VAZIO: o wizard lê a URL (useSearchParams), e
// numa página estática isso joga tudo pro navegador desenhar depois de baixar
// ~500 KB de JavaScript. No navegador do Instagram, em 4G, eram segundos de
// tela em branco logo depois do toque no anúncio — e quem desistia nesse
// intervalo nem entrava nas métricas (o rastreio também espera o JS). Com
// `connection()` o servidor já conhece a URL e manda a tela de chegada pronta.
// Custo: as duas consultas abaixo rodam a cada visita, em vez de a cada 5 min.
// Ocasiões e planos mudam raramente (só pelo admin): ficam 5 min na memória
// da instância, o mesmo prazo do antigo `revalidate = 300`. Sem isso cada
// visita esperava as duas consultas (~0,7 s) antes de receber a página.
const CACHE_MS = 5 * 60 * 1000
let cache: { em: number; initialOccasions: WizardOccasion[]; planos: PlanoResumo[] } | null = null

async function carregarOcasioes(): Promise<WizardOccasion[]> {
  try {
    return await getWizardOccasions()
  } catch {
    // Fallback resiliente: sem o banco, o cliente busca via /api/wizard e
    // mostra o skeleton enquanto isso.
    return []
  }
}

// Nome e preço dos planos ativos já vêm na página: quem chega por `?produto=`
// (anúncio, vitrine da home) vê o aviso "Plano escolhido" no primeiro desenho.
async function carregarPlanos(): Promise<PlanoResumo[]> {
  try {
    const { data } = await createServerClient()
      .from("products")
      .select("id, name, price, photo_limit, feat_lyrics_sync, credits_granted")
      .eq("active", true)
    return (data ?? []).map((p) => ({ id: p.id, name: p.name, price: Number(p.price), photo_limit: p.photo_limit, feat_lyrics_sync: p.feat_lyrics_sync, credits_granted: p.credits_granted }))
  } catch {
    return []
  }
}

async function dadosDaPagina(): Promise<{ initialOccasions: WizardOccasion[]; planos: PlanoResumo[] }> {
  const agora = Date.now()
  if (cache && agora - cache.em <= CACHE_MS) return cache
  const [initialOccasions, planos] = await Promise.all([carregarOcasioes(), carregarPlanos()])
  // Só guarda o que veio completo: com o banco fora, a próxima visita tenta de novo.
  if (initialOccasions.length && planos.length) cache = { em: agora, initialOccasions, planos }
  return { initialOccasions, planos }
}

export default async function CriarPage() {
  await connection()
  const { initialOccasions, planos } = await dadosDaPagina()
  return <CriarClient initialOccasions={initialOccasions} planos={planos} />
}
