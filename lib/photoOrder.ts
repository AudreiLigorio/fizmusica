import type { createServerClient } from "@/lib/supabase"

type DB = ReturnType<typeof createServerClient>

/**
 * Renumera o `sort_order` das fotos de um pedido em 0,1,2,… preservando a
 * ordem atual (capa primeiro).
 *
 * Existe porque o upload gravava `sort_order = quantidade de fotos existentes`:
 * duas fotos enviadas ao mesmo tempo liam a mesma contagem e ficavam com o
 * mesmo número, e apagar uma foto deixava buraco na sequência. Num pedido real
 * a ordem ficou `0 1 2 3 4 5 6 _ 8 9 9 10 …` — o 7 apagado e o 9 duplicado.
 *
 * Chamado depois de inserir e depois de apagar: barato (são no máximo algumas
 * dezenas de linhas) e idempotente, então também conserta pedidos antigos na
 * primeira vez que forem mexidos.
 */
export async function renumerarFotos(supabase: DB, orderId: string): Promise<void> {
  try {
    const { data: fotos } = await supabase
      .from("order_photos")
      .select("id, sort_order, is_cover, created_at")
      .eq("orderId", orderId)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }) // desempate estável entre duplicados

    if (!fotos?.length) return

    await Promise.all(
      fotos.map((f, i) =>
        f.sort_order === i
          ? Promise.resolve()
          : supabase.from("order_photos").update({ sort_order: i }).eq("id", f.id),
      ),
    )
  } catch (e) {
    // Ordenação errada é feia; travar o upload por causa dela é pior.
    console.error("[fotos] falha ao renumerar:", e instanceof Error ? e.message : e)
  }
}
