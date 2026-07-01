import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// GET: configuração + relatório (últimas execuções) + status de saúde + contagem do que está pendente de expurgo
export async function GET() {
  const supabase = createServerClient()

  const { data: settings } = await supabase
    .from("purge_settings")
    .select("photos_days, lead_days, enabled, music_enabled, music_days, updatedAt")
    .eq("id", 1)
    .maybeSingle()

  // Modo de produção da música (auto | review | manual), guardado no compositor.
  const { data: comp } = await supabase
    .from("composer_settings")
    .select("suno_mode")
    .eq("id", 1)
    .maybeSingle()
  const sunoMode = comp?.suno_mode ?? "review"

  const { data: logs } = await supabase
    .from("purge_log")
    .select("ran_at, photos_purged, leads_purged, recovery_sent, errors")
    .order("ran_at", { ascending: false })
    .limit(30)

  // Totais acumulados
  const totals = (logs ?? []).reduce(
    (acc, l) => ({
      photos: acc.photos + (l.photos_purged ?? 0),
      leads:  acc.leads  + (l.leads_purged ?? 0),
    }),
    { photos: 0, leads: 0 }
  )

  // Pendentes: pedidos UNPAID não-revisão mais velhos que os cortes
  const photosDays = settings?.photos_days ?? 7
  const leadDays   = settings?.lead_days ?? 60
  const photosCutoff = new Date(Date.now() - photosDays * 864e5).toISOString()
  const leadCutoff   = new Date(Date.now() - leadDays * 864e5).toISOString()

  const { count: pendingPhotos } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("paymentStatus", "UNPAID")
    .neq("is_revision", true)
    .lt("createdAt", photosCutoff)

  const { count: pendingLeads } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("paymentStatus", "UNPAID")
    .neq("is_revision", true)
    .lt("createdAt", leadCutoff)

  // Músicas publicadas (URLs geradas para clientes)
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br").replace(/\/$/, "")
  const musicEnabled = settings?.music_enabled ?? false
  const musicDays = settings?.music_days ?? 365
  const { data: musicRows } = await supabase
    .from("generated_music")
    .select("slug, views, publishedAt, createdAt, orderId")
    .not("slug", "is", null)
    .order("publishedAt", { ascending: false, nullsFirst: false })
    .limit(500)

  const musics = (musicRows ?? []).map((m) => {
    const base = m.publishedAt ?? m.createdAt
    let daysLeft: number | null = null
    if (musicEnabled && base) {
      const elapsed = (Date.now() - new Date(base).getTime()) / 864e5
      daysLeft = Math.max(0, Math.ceil(musicDays - elapsed))
    }
    return {
      code: String(m.orderId).slice(0, 8).toUpperCase(),
      orderId: m.orderId,
      url: `${baseUrl}/m/${m.slug}`,
      views: m.views ?? 0,
      publishedAt: m.publishedAt ?? m.createdAt,
      daysLeft, // null = permanente
    }
  })

  return NextResponse.json({
    settings: { ...(settings ?? { photos_days: 7, lead_days: 60, enabled: true, music_enabled: false, music_days: 365 }), suno_mode: sunoMode },
    logs: logs ?? [],
    totals,
    pending: { photos: pendingPhotos ?? 0, leads: pendingLeads ?? 0 },
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

  // Modo de produção da música → composer_settings
  if (["auto", "review", "manual"].includes(body.suno_mode)) {
    const { error: cErr } = await supabase
      .from("composer_settings")
      .update({ suno_mode: body.suno_mode })
      .eq("id", 1)
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
