import type { createServerClient } from "@/lib/supabase"

type DB = ReturnType<typeof createServerClient>

export type OrderEventType =
  | "pedido_criado"
  | "pagamento_confirmado"
  | "letra_aprovada"
  | "letra_reprocessada"
  | "foto_enviada"
  | "foto_removida"
  | "capa_definida"
  | "versao_principal_alterada"
  | "termo_entrega_aceito"
  | "revisao_solicitada"
  | "revisao_aceita"
  | "musica_gerada"
  | "musica_liberada"
  | "conteudo_gerado"

// Registra um evento no histórico do pedido (append-only — nunca sobrescreve).
// Falhas de log NUNCA devem quebrar o fluxo principal, por isso engolimos o erro.
export async function logOrderEvent(
  supabase: DB,
  orderId: string,
  type: OrderEventType,
  detail?: string,
  actor: "cliente" | "admin" | "system" = "cliente",
): Promise<void> {
  try {
    await supabase.from("order_events").insert({ orderId, type, detail: detail ?? null, actor })
  } catch (e) {
    console.error("[orderEvents] falha ao registrar", type, e instanceof Error ? e.message : e)
  }
}
