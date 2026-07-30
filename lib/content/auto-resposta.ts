import type { createServerClient } from "@/lib/supabase"

type DB = ReturnType<typeof createServerClient>

const GRAPH = "https://graph.instagram.com/v21.0"
const token = () => process.env.IG_LONG_LIVED_TOKEN ?? ""

// Resposta automática a comentário com intenção de compra.
//
// Mecânica padrão do Instagram e a que mais converte: a pessoa comenta
// perguntando preço, recebe uma resposta pública curta ("te chamei no direct")
// e um DM com o link. A Meta permite UMA resposta privada por comentário, até
// 7 dias depois, e ela fura a janela de 24 horas.
//
// Três travas, porque isto fala em nome da marca sem ninguém revisar:
//   1. só dispara em comentário com sinal de compra — comentário emocional
//      ("que lindo") é conversa, não lead, e responder com venda estraga;
//   2. nunca dispara em peça de luto/homenagem póstuma (parametrizável);
//   3. uma vez por comentário — repetir é erro de API e incômodo.

async function igPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}/${path}?access_token=${token()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.error) throw new Error(json.error?.message ?? res.statusText)
  return json
}

/** Resposta pública no próprio comentário. */
async function responderPublico(commentId: string, mensagem: string) {
  return igPost(`${commentId}/replies`, { message: mensagem })
}

/**
 * Resposta privada (DM) ancorada no comentário. Só funciona uma vez por
 * comentário e dentro de 7 dias — depois disso a Meta recusa.
 */
async function responderPrivado(userId: string, commentId: string, mensagem: string) {
  return igPost(`${userId}/messages`, {
    recipient: { comment_id: commentId },
    message: { text: mensagem },
  })
}

type Config = {
  auto_resposta: boolean
  resposta_publica: string | null
  resposta_dm: string | null
  auto_resposta_luto: boolean
}

const SETE_DIAS = 7 * 24 * 60 * 60 * 1000

export async function responderComentariosPendentes(supabase: DB): Promise<{ respondidos: number; pulados: number }> {
  const { data: cfg } = await supabase
    .from("content_settings")
    .select("auto_resposta, resposta_publica, resposta_dm, auto_resposta_luto")
    .eq("id", 1)
    .maybeSingle()

  const config = (cfg ?? {}) as Config
  if (!config.auto_resposta) return { respondidos: 0, pulados: 0 }

  const { data: pendentes } = await supabase
    .from("content_comments")
    .select("id, draft_id, texto, username, criado_em, dm_enviado_em")
    .eq("intencao_compra", true)
    .is("dm_enviado_em", null)
    .order("criado_em", { ascending: true })
    .limit(20)

  if (!pendentes?.length) return { respondidos: 0, pulados: 0 }

  const { data: me } = await fetch(`${GRAPH}/me?fields=id&access_token=${token()}`)
    .then((r) => r.json())
    .then((j) => ({ data: j }))
    .catch(() => ({ data: null }))
  const userId = me?.id
  if (!userId) return { respondidos: 0, pulados: pendentes.length }

  let respondidos = 0
  let pulados = 0

  for (const c of pendentes) {
    try {
      // Janela da Meta: passou de 7 dias, a resposta privada é recusada.
      if (c.criado_em && Date.now() - new Date(c.criado_em).getTime() > SETE_DIAS) {
        await supabase.from("content_comments")
          .update({ erro_resposta: "fora da janela de 7 dias da Meta" }).eq("id", c.id)
        pulados++
        continue
      }

      // Peça de luto nunca recebe resposta comercial automática.
      if (config.auto_resposta_luto && c.draft_id) {
        const { data: peca } = await supabase
          .from("content_drafts")
          .select("persona, emocao_alvo, topic")
          .eq("id", c.draft_id)
          .maybeSingle()
        const contexto = `${peca?.persona ?? ""} ${peca?.emocao_alvo ?? ""} ${peca?.topic ?? ""}`
        if (/luto|despedida|póstum|postum|falecid|saudade de quem partiu/i.test(contexto)) {
          await supabase.from("content_comments")
            .update({ erro_resposta: "peça de luto — resposta automática bloqueada" }).eq("id", c.id)
          pulados++
          continue
        }
      }

      if (config.resposta_publica?.trim()) {
        await responderPublico(c.id, config.resposta_publica)
        await supabase.from("content_comments")
          .update({ resposta_publica_em: new Date().toISOString() }).eq("id", c.id)
      }

      await responderPrivado(userId, c.id, config.resposta_dm ?? "")
      await supabase.from("content_comments")
        .update({ dm_enviado_em: new Date().toISOString(), erro_resposta: null }).eq("id", c.id)
      respondidos++
    } catch (e) {
      const msg = e instanceof Error ? e.message : "falha ao responder"
      await supabase.from("content_comments").update({ erro_resposta: msg }).eq("id", c.id)
      pulados++
    }
  }

  return { respondidos, pulados }
}
