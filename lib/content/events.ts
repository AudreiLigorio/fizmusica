import type { createServerClient } from "@/lib/supabase"

type DB = ReturnType<typeof createServerClient>

export type ContentEventType =
  | "rascunho_criado"
  | "imagem_gerada"
  | "imagem_falhou"
  | "aprovado"
  | "rejeitado"
  | "video_concluido"
  | "video_falhou"
  | "publicado"
  | "publicacao_falhou"

// Registra um evento no histórico do rascunho — append-only, mesmo padrão de
// lib/orderEvents.ts. Falhas de log nunca devem quebrar o fluxo principal.
export async function logContentEvent(
  supabase: DB,
  contentDraftId: string,
  type: ContentEventType,
  detail?: string,
  actor: "admin" | "system" = "system",
): Promise<void> {
  try {
    await supabase.from("content_events").insert({ contentDraftId, type, detail: detail ?? null, actor })
  } catch (e) {
    console.error("[contentEvents] falha ao registrar", type, e instanceof Error ? e.message : e)
  }
}
