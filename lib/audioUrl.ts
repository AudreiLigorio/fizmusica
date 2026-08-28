import type { createServerClient } from "@/lib/supabase"

type DB = ReturnType<typeof createServerClient>

export const BUCKET_SONGS = "songs"

// Quanto tempo a URL assinada vale. Curto de propósito: ela só precisa
// sobreviver ao tempo entre o navegador pedir e começar a tocar. Copiar e
// colar num chat deixa de funcionar em minutos.
//
// Não pode ser curto DEMAIS: o navegador refaz a requisição ao arrastar a
// barra de progresso (Range request), e uma música de 4 min pode ser ouvida
// aos poucos. 30 min cobre isso com folga.
export const VALIDADE_URL_SEGUNDOS = 30 * 60

// O banco guarda a URL pública inteira (decisão antiga, quando o bucket era
// público). Pra assinar preciso do CAMINHO dentro do bucket — extraído da
// própria URL em vez de gravar uma coluna nova, que exigiria migração e
// backfill de 70 músicas por um dado que já está ali.
export function caminhoNoBucket(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/songs\/(.+?)(?:\?|$)/)
  return m ? decodeURIComponent(m[1]) : null
}

// URL assinada e temporária para um arquivo do bucket songs.
//
// Existe porque o bucket era PÚBLICO e o endereço do MP3, permanente: bastava
// abrir o inspetor (ou ler a resposta de /api/catalog) pra baixar a música de
// qualquer cliente, sem conta. Auditado em 2026-08-28 — baixei 4,4 MB com
// dois comandos.
export async function urlAssinadaDoAudio(
  supabase: DB,
  urlPublicaOuCaminho: string | null | undefined,
): Promise<string | null> {
  const caminho = urlPublicaOuCaminho?.startsWith("http")
    ? caminhoNoBucket(urlPublicaOuCaminho)
    : (urlPublicaOuCaminho ?? null)
  if (!caminho) return null
  const { data, error } = await supabase.storage
    .from(BUCKET_SONGS)
    .createSignedUrl(caminho, VALIDADE_URL_SEGUNDOS)
  if (error) {
    console.error("[audioUrl] falha ao assinar", caminho, error.message)
    return null
  }
  return data?.signedUrl ?? null
}
