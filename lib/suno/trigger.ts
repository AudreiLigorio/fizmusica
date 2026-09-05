import type { createServerClient } from "@/lib/supabase"
import { generateMusic } from "./client"
import { mapVocalGender, buildTitle } from "./params"
import { buildSunoStyle } from "@/lib/composer/style"
import { getComposerSettings } from "@/lib/composer/settings"

type DB = ReturnType<typeof createServerClient>

// Marcador gravado em sunoError quando a geração já é um auto-retry, para a próxima
// falha NÃO retentar de novo (evita loop). Limpo no sucesso (ingest) e numa nova geração manual.
export const AUTORETRY_SENTINEL = "__autoretry__"

type OrderForGen = {
  id: string
  lyricsDraft?: string | null
  musicalStyle?: string | null
  voiceType?: string | null
  emotion?: string | null
  honoreeName?: string | null
  nome?: string | null
  subcategory?: string | null
  revision_note?: string | null
  // Estilo que o CLIENTE aprovou no card "Como sua música vai soar".
  // Tem precedência sobre a extração automática — ver o uso abaixo.
  style_confirmed?: string | null
}

// Host canônico p/ o webhook: o apex faz 308→www e webhook não segue redirect em POST.
function callbackUrl(): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000")
    .replace("://fizmusica.com.br", "://www.fizmusica.com.br")
  return `${base}/api/suno/callback`
}

// Dispara a geração no Suno e atualiza o pedido (taskId + GENERATING).
// Em caso de erro, marca FAILED e relança (o chamador decide se ignora).
// opts.avoid: termo a remover do estilo (palavra bloqueada pelo Suno). opts.isRetry:
// marca a geração como auto-retry para não retentar em cadeia.
export async function triggerSunoGeneration(
  supabase: DB,
  order: OrderForGen,
  opts?: { avoid?: string; isRetry?: boolean },
): Promise<string> {
  if (!order.lyricsDraft?.trim()) throw new Error("Sem letra para gerar a música.")
  const settings = await getComposerSettings()
  try {
    // O que o cliente confirmou vence a extração automática.
    //
    // Importa no "gerar novamente" e na revisão: sem isto, a segunda versão
    // sairia com um estilo reextraído do zero, diferente do que ele viu e
    // aprovou na tela. Ele leria como defeito, não como variação.
    //
    // A exceção é o retry por termo bloqueado (`avoid`): aí é justamente o
    // texto que precisa ser reescrito sem a palavra que o Suno recusou.
    const confirmado = order.style_confirmed?.trim()
    const style = confirmado && !opts?.avoid
      ? confirmado
      : await buildSunoStyle(order, { avoid: opts?.avoid })
    const taskId = await generateMusic({
      prompt: order.lyricsDraft,
      style: style || "Pop",
      title: buildTitle(order),
      vocalGender: mapVocalGender(order),
      model: settings.sunoModel,
      callBackUrl: callbackUrl(),
    })
    await supabase
      .from("orders")
      .update({ sunoTaskId: taskId, sunoStatus: "GENERATING", sunoError: opts?.isRetry ? AUTORETRY_SENTINEL : null, sunoTracks: null })
      .eq("id", order.id)
    return taskId
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar a música."
    await supabase.from("orders").update({ sunoStatus: "FAILED", sunoError: message }).eq("id", order.id)
    throw e
  }
}
