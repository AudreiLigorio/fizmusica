import type { createServerClient } from "@/lib/supabase"

type DB = ReturnType<typeof createServerClient>

const GRAPH = "https://graph.instagram.com/v21.0"
const token = () => process.env.IG_LONG_LIVED_TOKEN ?? ""

// Coletor de métricas e comentários do Instagram.
//
// Coleta, não analisa. Com 4 seguidores e alcance de 3, qualquer "análise"
// seria ruído virando conclusão confiante — o pior resultado possível. O valor
// aqui é acumular série histórica desde o primeiro post, porque o Instagram não
// devolve retroativo: o que não for guardado hoje não existe depois. Quando
// houver base (~20 posts ou 30 dias), o analista tem o que dizer.

const METRICAS = ["reach", "likes", "comments", "saved", "shares", "total_interactions"] as const

async function ig(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set("access_token", token())
  const res = await fetch(url.toString())
  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error?.message ?? res.statusText)
  return json
}

const hoje = () => new Date().toISOString().slice(0, 10)

/** Métricas de cada post publicado. Uma linha por post por dia. */
export async function coletarMetricasDePosts(supabase: DB): Promise<number> {
  const { data: publicados } = await supabase
    .from("content_drafts")
    .select("id, published_platform_id, published_at")
    .not("published_platform_id", "is", null)
    .order("published_at", { ascending: false })
    .limit(100)

  let gravados = 0
  for (const d of publicados ?? []) {
    try {
      const r = await ig(`${d.published_platform_id}/insights`, { metric: METRICAS.join(",") })
      const valores: Record<string, number> = {}
      for (const m of r.data ?? []) valores[m.name] = m.values?.[0]?.value ?? 0

      const { error } = await supabase.from("content_metrics").upsert(
        {
          draft_id: d.id,
          media_id: d.published_platform_id,
          dia: hoje(),
          reach: valores.reach ?? null,
          likes: valores.likes ?? null,
          comments: valores.comments ?? null,
          saved: valores.saved ?? null,
          shares: valores.shares ?? null,
          total_interactions: valores.total_interactions ?? null,
        },
        { onConflict: "media_id,dia" },
      )
      if (!error) gravados++
    } catch (e) {
      // Post apagado no Instagram, métrica ainda indisponível ou limite de
      // chamadas: nada disso pode derrubar a coleta dos outros.
      console.error(`[insights] post ${d.published_platform_id}:`, e instanceof Error ? e.message : e)
    }
  }
  return gravados
}

/** Retrato diário da conta — é a série que mostra crescimento de verdade. */
export async function coletarMetricasDaConta(supabase: DB): Promise<void> {
  try {
    const me = await ig("me", { fields: "followers_count,media_count" })
    await supabase.from("account_metrics").upsert(
      { dia: hoje(), followers_count: me.followers_count ?? null, media_count: me.media_count ?? null },
      { onConflict: "dia" },
    )
  } catch (e) {
    console.error("[insights] conta:", e instanceof Error ? e.message : e)
  }
}

// Sinais de intenção de compra. Lista simples de propósito: é previsível,
// custa zero e erra pouco. Comentário emocional ("que lindo") não é lead;
// pergunta de preço é.
const SINAIS = [
  "quanto custa", "quanto fica", "qual o valor", "valor", "preço", "preco", "quanto é", "quanto e",
  "como faço", "como faco", "como funciona", "como encomendo", "encomendar", "quero uma", "quero fazer",
  "comprar", "orçamento", "orcamento", "whatsapp", "zap", "link", "onde peço", "onde peco",
]

function temIntencaoDeCompra(texto: string): boolean {
  const t = texto.toLowerCase()
  return SINAIS.some((s) => t.includes(s))
}

/** Comentários dos posts publicados, marcando os que parecem lead. */
export async function coletarComentarios(supabase: DB): Promise<number> {
  const { data: publicados } = await supabase
    .from("content_drafts")
    .select("id, published_platform_id")
    .not("published_platform_id", "is", null)
    .order("published_at", { ascending: false })
    .limit(30)

  let novos = 0
  for (const d of publicados ?? []) {
    try {
      const r = await ig(`${d.published_platform_id}/comments`, { fields: "id,text,username,timestamp" })
      for (const c of r.data ?? []) {
        const { error } = await supabase.from("content_comments").upsert(
          {
            id: c.id,
            media_id: d.published_platform_id,
            draft_id: d.id,
            username: c.username ?? null,
            texto: c.text ?? "",
            intencao_compra: temIntencaoDeCompra(c.text ?? ""),
            criado_em: c.timestamp ?? null,
          },
          { onConflict: "id", ignoreDuplicates: false },
        )
        if (!error) novos++
      }
    } catch (e) {
      console.error(`[insights] comentários ${d.published_platform_id}:`, e instanceof Error ? e.message : e)
    }
  }
  return novos
}

export async function coletarTudo(supabase: DB) {
  const posts = await coletarMetricasDePosts(supabase)
  await coletarMetricasDaConta(supabase)
  const comentarios = await coletarComentarios(supabase)
  return { posts, comentarios }
}
