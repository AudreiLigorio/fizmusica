import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { runPurge } from "@/lib/purge"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

// GET: configuração + relatório (últimas execuções) + status de saúde + contagem do que está pendente de expurgo
export async function GET() {
  const supabase = createServerClient()

  const { data: settings } = await supabase
    .from("purge_settings")
    .select("photos_days, lead_days, enabled, music_enabled, music_days, updatedAt")
    .eq("id", 1)
    .maybeSingle()

  // Modo de produção da música (auto | review | manual) e aceite da revisão do
  // cliente (auto | manual), guardados no compositor.
  const { data: comp } = await supabase
    .from("composer_settings")
    .select("suno_mode, revision_auto_accept")
    .eq("id", 1)
    .maybeSingle()
  const sunoMode = comp?.suno_mode ?? "review"
  const revisionAutoAccept = comp?.revision_auto_accept ?? false

  const { data: logs } = await supabase
    .from("purge_log")
    // `*` de propósito: nomear as colunas faz o select inteiro falhar quando uma
    // delas ainda não existe (migration não aplicada), e aí o relatório de
    // expurgo some da tela inteiro em vez de só faltar um número.
    .select("*")
    .order("ran_at", { ascending: false })
    .limit(30)

  // Totais acumulados
  const totals = (logs ?? []).reduce(
    (acc, l) => ({
      photos: acc.photos + (l.photos_purged ?? 0),
      leads:  acc.leads  + (l.leads_purged ?? 0),
      paidPhotos: acc.paidPhotos + (l.paid_photos_purged ?? 0),
    }),
    { photos: 0, leads: 0, paidPhotos: 0 }
  )

  // Pendentes: pedidos UNPAID não-revisão mais velhos que os cortes
  const photosDays = settings?.photos_days ?? 7
  const leadDays   = settings?.lead_days ?? 60
  const photosCutoff = new Date(Date.now() - photosDays * 864e5).toISOString()
  const leadCutoff   = new Date(Date.now() - leadDays * 864e5).toISOString()

  // Conta FOTOS de verdade, não pedidos. Antes este número vinha da tabela
  // `orders` e o painel exibia "52 fotos aguardando expurgo" quando o passivo
  // real era zero — os pedidos existiam, as fotos já tinham sido apagadas.
  const { data: pedidosComFotoVencida } = await supabase
    .from("orders")
    .select("id")
    .eq("paymentStatus", "UNPAID")
    .neq("is_revision", true)
    .lt("createdAt", photosCutoff)
    .limit(500)

  let pendingPhotos = 0
  const idsFoto = (pedidosComFotoVencida ?? []).map((o) => o.id)
  if (idsFoto.length > 0) {
    const { count } = await supabase
      .from("order_photos")
      .select("id", { count: "exact", head: true })
      .in("orderId", idsFoto)
    pendingPhotos = count ?? 0
  }

  const { count: pendingLeads } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("paymentStatus", "UNPAID")
    .neq("is_revision", true)
    .lt("createdAt", leadCutoff)

  // Sessões do wizard vencidas: mesmo corte do lead. Guardam nome, e-mail e a
  // história inteira (e agora a letra da prévia), então precisam aparecer no
  // painel como passivo — durante meses elas sobreviveram ao pedido que o
  // expurgo apagava, o que tornava o expurgo do cadastro incompleto.
  const { count: pendingSessions } = await supabase
    .from("wizard_sessions")
    .select("id", { count: "exact", head: true })
    .lt("updated_at", leadCutoff)

  // Músicas publicadas (URLs geradas para clientes)
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br").replace(/\/$/, "")
  const musicEnabled = settings?.music_enabled ?? false
  const musicDays = settings?.music_days ?? 365
  const { data: musicRows } = await supabase
    .from("generated_music")
    .select("slug, views, publishedAt, createdAt, orderId, link_disabled_at")
    .not("slug", "is", null)
    .order("publishedAt", { ascending: false, nullsFirst: false })
    .limit(500)

  const musics = (musicRows ?? []).map((m) => {
    const base = m.publishedAt ?? m.createdAt
    let daysLeft: number | null = null
    if (musicEnabled && base && !m.link_disabled_at) {
      const elapsed = (Date.now() - new Date(base).getTime()) / 864e5
      daysLeft = Math.max(0, Math.ceil(musicDays - elapsed))
    }
    return {
      code: String(m.orderId).slice(0, 8).toUpperCase(),
      orderId: m.orderId,
      url: `${baseUrl}/m/${m.slug}`,
      views: m.views ?? 0,
      publishedAt: m.publishedAt ?? m.createdAt,
      linkDisabled: !!m.link_disabled_at,
      daysLeft, // null = permanente (ou já desativado)
    }
  })

  return NextResponse.json({
    settings: { ...(settings ?? { photos_days: 7, lead_days: 60, enabled: true, music_enabled: false, music_days: 365 }), suno_mode: sunoMode, revision_auto_accept: revisionAutoAccept },
    logs: logs ?? [],
    totals,
    pending: { photos: pendingPhotos ?? 0, leads: pendingLeads ?? 0, sessions: pendingSessions ?? 0 },
    musics,
  })
}

// PUT: atualiza configuração
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (typeof body.photos_days === "number")  update.photos_days   = Math.max(1, Math.floor(body.photos_days))
  if (typeof body.lead_days === "number")    update.lead_days     = Math.max(1, Math.floor(body.lead_days))
  if (typeof body.enabled === "boolean")     update.enabled       = body.enabled
  if (typeof body.music_enabled === "boolean") update.music_enabled = body.music_enabled
  if (typeof body.music_days === "number")   update.music_days    = Math.max(1, Math.floor(body.music_days))

  const { error } = await supabase.from("purge_settings").update(update).eq("id", 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Modo de produção da música + aceite da revisão do cliente → composer_settings
  const compUpdate: Record<string, unknown> = {}
  if (["auto", "review", "manual"].includes(body.suno_mode)) compUpdate.suno_mode = body.suno_mode
  if (typeof body.revision_auto_accept === "boolean") compUpdate.revision_auto_accept = body.revision_auto_accept
  if (Object.keys(compUpdate).length > 0) {
    const { error: cErr } = await supabase
      .from("composer_settings")
      .update(compUpdate)
      .eq("id", 1)
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// Executa o expurgo na hora, sem esperar o cron das 7h. Uma rotina que apaga
// dado pessoal precisa poder ser rodada e conferida sob supervisão — e foi
// assim que descobrimos que ela estava travada há três semanas.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const supabase = createServerClient()
  try {
    const purge = await runPurge(supabase)
    await supabase.from("purge_log").insert({
      photos_purged:      purge.photosPurged,
      leads_purged:       purge.leadsPurged,
      music_purged:       purge.musicPurged ?? 0,
      paid_photos_purged: purge.paidPhotosPurged ?? 0,
      sessions_purged:    purge.sessionsPurged ?? 0,
      recovery_sent:      0,
      errors:             purge.errors.length ? purge.errors.join(" | ") : null,
    })
    return NextResponse.json({ ok: true, purge })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no expurgo." }, { status: 500 })
  }
}
