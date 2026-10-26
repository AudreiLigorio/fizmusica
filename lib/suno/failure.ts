import type { createServerClient } from "@/lib/supabase"
import { getMusicDetails } from "./client"
import { triggerSunoGeneration, AUTORETRY_SENTINEL } from "./trigger"
import { logOrderEvent } from "@/lib/orderEvents"

type DB = ReturnType<typeof createServerClient>

// A KIE não publica catálogo de recusas de conteúdo: os códigos documentados
// são de transporte (401 chave, 402 crédito, 429 limite, 5xx servidor) e o
// motivo real vem como TEXTO LIVRE em inglês, que o fornecedor pode reescrever
// quando quiser. Então classificar é necessariamente heurístico — e por isso o
// padrão é NÃO envolver o cliente: só o que reconhecemos com segurança vira
// pedido de ação pra ele.
export function pedeAcaoDoCliente(msg: string): "letra_protegida" | null {
  if (/copyright|copyrighted material/i.test(msg)) return "letra_protegida"
  return null
}

// Extrai o termo que o Suno bloqueou da mensagem de erro do KIE, para regenerar sem ele.
// Ex.: "Your tags contain artist name oficina g3 - we don't reference specific artists"
function parseBlockedTerm(msg: string): string | undefined {
  if (!msg) return undefined
  let m = msg.match(/artist name\s+(.+?)\s*[-–—]/i)
  if (m) return m[1].trim()
  m = msg.match(/contains?\s+(?:the\s+)?(?:word|name|artist|tag)?\s*["']?(.+?)["']?\s*[-–—]/i)
  if (m) return m[1].trim()
  return undefined
}

// Tratamento central de falha do Suno: consulta o KIE (fonte autoritativa) para gravar
// o MOTIVO REAL no pedido (em vez de "não retornou faixas") e, se for palavra sensível
// (ex.: nome de artista nas tags), regenera UMA vez removendo o termo bloqueado.
export async function handleSunoFailure(supabase: DB, orderId: string, taskId: string): Promise<void> {
  const { data: order } = await supabase
    .from("orders")
    .select("id, sunoError, lyricsDraft, musicalStyle, voiceType, emotion, honoreeName, nome, subcategory, revision_note, style_confirmed, style_reference")
    .eq("id", orderId)
    .single()
  if (!order) return

  const wasAutoRetry = order.sunoError === AUTORETRY_SENTINEL

  let errMsg = "Falha na geração da música."
  let isSensitive = false
  let avoid: string | undefined
  try {
    const d = await getMusicDetails(taskId)
    const st: string = d?.data?.status ?? ""
    errMsg = d?.data?.errorMessage || d?.msg || errMsg
    isSensitive = /SENSITIVE/i.test(st) || /artist name|sensitive word|specific artists/i.test(errMsg)
    avoid = parseBlockedTerm(errMsg)
  } catch {
    // Sem detalhes do KIE: mantém a mensagem genérica.
  }

  // Mensagem amigável (a do KIE vem em inglês). Para palavra sensível, explica e diz o que fazer.
  let display = errMsg
  if (isSensitive) {
    const willRetry = !wasAutoRetry
    const termo = avoid ? `o termo "${avoid}"` : "uma palavra"
    display = willRetry
      ? `O Suno bloqueou ${termo} nas tags de estilo (não aceita nomes de artistas). Regenerando automaticamente sem ele…`
      : `O Suno bloqueou ${termo} nas tags de estilo (não aceita nomes de artistas). Edite o estilo/nota e gere de novo.`
  }

  // Grava o motivo real para o admin enxergar no painel.
  await supabase.from("orders").update({ sunoStatus: "FAILED", sunoError: display }).eq("id", orderId)

  // Registra a recusa no histórico com o texto CRU do fornecedor. Sem isto o
  // sistema é cego: `sunoError` é estado atual e some no próximo sucesso, então
  // toda recusa anterior se perdeu — não dá pra saber se um tipo acontece uma
  // vez por mês ou toda semana, nem medir se o tratamento resolveu.
  await logOrderEvent(supabase, orderId, "musica_recusada", errMsg.slice(0, 500), "system")

  // Recusa que o cliente resolve: devolve a letra pra ele editar. A área do
  // cliente é guiada por `lyricsApproved` — zerar faz o pedido subir pro topo
  // como "precisa da sua ação" e reabrir a etapa da Letra sozinho. Sem isso o
  // aviso seria cruel: mostraríamos o problema com a edição travada em 409.
  const acionavel = pedeAcaoDoCliente(errMsg)
  if (acionavel) {
    await supabase
      .from("orders")
      .update({ lyricsApproved: false, lyrics_rejection: acionavel })
      .eq("id", orderId)
    return
  }

  // Auto-retry único para palavra sensível: regenera sem o termo bloqueado.
  if (isSensitive && !wasAutoRetry) {
    try {
      // Fica gravado para o cliente ver o que mudou no pedido dele. Alterar a
      // encomenda de alguém em silêncio não é aceitável: ela pediu uma
      // referência de artista e vai receber uma música sem ela.
      if (avoid) {
        await supabase.from("orders").update({ estilo_termo_removido: avoid }).eq("id", orderId)
      }
      await triggerSunoGeneration(supabase, order, { avoid, isRetry: true })
    } catch {
      // Se o retry falhar ao disparar, o pedido permanece FAILED com o motivo real.
    }
  }
}
