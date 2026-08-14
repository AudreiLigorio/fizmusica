import type { createServerClient } from "@/lib/supabase"

// Expurgo LGPD: apaga fotos de terceiros de pedidos sem compra, desativa links
// de música vencidos e elimina o cadastro do lead não convertido. Nunca toca em
// pedido PAGO nem em pedido de revisão.
//
// Mora aqui, e não dentro da rota do cron, porque dois gatilhos chamam a mesma
// coisa: o agendamento diário e o botão "rodar agora" da tela Operação — uma
// rotina que apaga dado pessoal precisa poder ser executada e conferida na hora.

const BUCKET = "order-photos"

// Expurga fotos (fotos de terceiros sem compra) e, depois, o cadastro do lead.
// Nunca toca em pedidos PAGOS nem em pedidos de revisão.
export async function runPurge(supabase: ReturnType<typeof createServerClient>) {
  const errors: string[] = []
  let photosPurged = 0
  let leadsPurged  = 0
  let paidPhotosPurged = 0
  let sessionsPurged = 0

  let musicPurged = 0 // conta LINKS DESATIVADOS (não apaga mais o MP3 — ver migration 023)

  // Configuração editável na tela Operação
  const { data: settings } = await supabase
    .from("purge_settings")
    .select("photos_days, lead_days, enabled, music_enabled, music_days")
    .eq("id", 1)
    .maybeSingle()

  if (!settings) {
    return { photosPurged, leadsPurged, musicPurged, paidPhotosPurged, sessionsPurged, errors, skipped: true }
  }

  // Desativação do LINK PÚBLICO após o prazo (opcional, desligado por padrão).
  // O MP3/letra NUNCA são apagados — a Fiz Música retém a obra por direito
  // (Licença de Uso, cláusulas 6+9). Só o acesso público (/m/slug) para de
  // funcionar. No MESMO evento, as FOTOS do pedido são removidas (dado mais
  // sensível — imagem de pessoa real; nunca reutilizadas, conforme os Termos).
  if (settings.music_enabled) {
    try {
      const musicCutoff = new Date(Date.now() - settings.music_days * 24 * 60 * 60 * 1000).toISOString()
      const { data: oldMusic } = await supabase
        .from("generated_music")
        .select("id, orderId")
        .not("slug", "is", null)
        .is("link_disabled_at", null)
        .lt("publishedAt", musicCutoff)
        .limit(100)

      for (const m of oldMusic ?? []) {
        const { error: updErr } = await supabase
          .from("generated_music")
          .update({ link_disabled_at: new Date().toISOString() })
          .eq("id", m.id)
        if (updErr) { errors.push(`generated_music update: ${updErr.message}`); continue }
        musicPurged++

        // Fotos do pedido: removidas junto (arquivo + registro), capa da IA inclusa.
        const { data: photos } = await supabase
          .from("order_photos")
          .select("id, storage_path")
          .eq("orderId", m.orderId)
        if (photos && photos.length > 0) {
          const paths = photos.map((p) => p.storage_path).filter(Boolean)
          if (paths.length > 0) {
            const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths)
            if (rmErr) errors.push(`order-photos remove: ${rmErr.message}`)
          }
          const { error: delErr } = await supabase.from("order_photos").delete().eq("orderId", m.orderId)
          if (delErr) errors.push(`order_photos delete: ${delErr.message}`)
          else paidPhotosPurged += photos.length
        }
      }
    } catch (e: any) {
      errors.push(`link/fotos: ${e?.message ?? e}`)
    }
  }

  if (!settings.enabled) {
    return { photosPurged, leadsPurged, musicPurged, paidPhotosPurged, sessionsPurged, errors, skipped: true }
  }

  const photosCutoff = new Date(Date.now() - settings.photos_days * 24 * 60 * 60 * 1000).toISOString()
  const leadCutoff   = new Date(Date.now() - settings.lead_days  * 24 * 60 * 60 * 1000).toISOString()

  try {
    // 1) Expurgo de FOTOS: pedidos UNPAID, não-revisão, mais velhos que photos_days
    const { data: oldUnpaid } = await supabase
      .from("orders")
      .select("id")
      .eq("paymentStatus", "UNPAID")
      .neq("is_revision", true)
      .lt("createdAt", photosCutoff)
      .limit(200)

    const ids = (oldUnpaid ?? []).map((o) => o.id)
    if (ids.length > 0) {
      const { data: photos } = await supabase
        .from("order_photos")
        .select("id, storage_path")
        .in("orderId", ids)

      if (photos && photos.length > 0) {
        const paths = photos.map((p) => p.storage_path).filter(Boolean)
        if (paths.length > 0) {
          const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths)
          if (rmErr) errors.push(`storage remove: ${rmErr.message}`)
        }
        const { error: delErr } = await supabase
          .from("order_photos")
          .delete()
          .in("id", photos.map((p) => p.id))
        if (delErr) errors.push(`order_photos delete: ${delErr.message}`)
        else photosPurged = photos.length
      }
    }
  } catch (e: any) {
    errors.push(`fotos: ${e?.message ?? e}`)
  }

  try {
    // 2) Expurgo do CADASTRO: pedidos UNPAID, não-revisão, mais velhos que lead_days
    const { data: deadLeads } = await supabase
      .from("orders")
      .select("id")
      .eq("paymentStatus", "UNPAID")
      .neq("is_revision", true)
      .lt("createdAt", leadCutoff)
      .limit(200)

    const ids = (deadLeads ?? []).map((o) => o.id)

    if (ids.length > 0) {
      // TRAVA: pedido marcado como não pago PODE ter um pagamento aprovado que
      // não sincronizou de volta (já aconteceu neste projeto). Apagar destruiria
      // a prova de uma venda real, então esses ficam de fora e são reportados.
      const { data: pagamentos } = await supabase
        .from("payments")
        .select("id, orderId, status")
        .in("orderId", ids)

      const suspeitos = new Set(
        (pagamentos ?? []).filter((p) => (p.status ?? "").toUpperCase() !== "UNPAID").map((p) => p.orderId),
      )
      if (suspeitos.size > 0) {
        errors.push(
          `${suspeitos.size} pedido(s) preservados: marcados UNPAID mas com pagamento em outro status — ` +
          `confira antes de apagar (${[...suspeitos].join(", ")})`,
        )
      }

      const alvos = ids.filter((id) => !suspeitos.has(id))

      // Um a um, e não em lote: no lote, um único pedido que viole chave
      // estrangeira aborta a instrução inteira e os outros 47 ficam para trás
      // — foi o que manteve o expurgo parado desde 09/07/2026.
      for (const id of alvos) {
        // Dependências que não têm "on delete cascade" precisam sair antes.
        // payments é a que faltava: checkout abandonado deixa a linha lá, com
        // payer_email dentro, e o banco recusava o delete do pedido.
        await supabase.from("payments").delete().eq("orderId", id)
        await supabase.from("order_answers").delete().eq("orderId", id)
        await supabase.from("generated_music").delete().eq("orderId", id)
        await supabase.from("revision_requests").delete().eq("orderId", id)

        const { data: leftover } = await supabase
          .from("order_photos")
          .select("id, storage_path")
          .eq("orderId", id)
        if (leftover && leftover.length > 0) {
          const paths = leftover.map((p) => p.storage_path).filter(Boolean)
          if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths)
          await supabase.from("order_photos").delete().eq("orderId", id)
        }

        const { error: delErr } = await supabase.from("orders").delete().eq("id", id)
        if (delErr) errors.push(`orders delete (${id}): ${delErr.message}`)
        else leadsPurged++
      }
    }
  } catch (e: any) {
    errors.push(`lead: ${e?.message ?? e}`)
  }

  try {
    // 3) Expurgo das SESSÕES DO WIZARD, no mesmo corte do lead.
    //
    // Sem isto o expurgo do cadastro era teatro: o pedido não pago sumia aos 30
    // dias enquanto a MESMA história — com nome, e-mail e WhatsApp — continuava
    // viva em `wizard_sessions`, que só era apagada quando alguém clicava em
    // "começar do zero". A prévia da letra agravou, porque a sessão passou a
    // guardar também a música gerada.
    //
    // Apaga inclusive sessão de quem comprou: passado o prazo ela é cópia
    // redundante: o pedido tem as respostas, e a letra da prévia já virou
    // rascunho do pedido na criação.
    const { data: velhas } = await supabase
      .from("wizard_sessions")
      .select("id")
      .lt("updated_at", leadCutoff)
      .limit(500)

    const alvos = (velhas ?? []).map((s) => s.id)
    if (alvos.length > 0) {
      const { error: delErr } = await supabase.from("wizard_sessions").delete().in("id", alvos)
      if (delErr) errors.push(`wizard_sessions delete: ${delErr.message}`)
      else sessionsPurged = alvos.length
    }
  } catch (e: any) {
    errors.push(`sessões: ${e?.message ?? e}`)
  }

  try {
    // 4) Contador diário de prévias por IP: descartável depois de alguns dias,
    // e é a única tabela do sistema com derivado de IP.
    const limiteContador = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
    await supabase.from("preview_rate_limit").delete().lt("day", limiteContador)
  } catch (e: any) {
    errors.push(`contador de prévia: ${e?.message ?? e}`)
  }

  return { photosPurged, leadsPurged, musicPurged, paidPhotosPurged, sessionsPurged, errors }
}
