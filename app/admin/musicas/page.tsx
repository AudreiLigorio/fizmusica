import { createServerClient } from "@/lib/supabase"
import MusicasList from "./MusicasList"

export const dynamic = "force-dynamic"

async function getMusicas() {
  const supabase = createServerClient()

  const { data: musicRows } = await supabase
    .from("generated_music")
    .select("id, orderId, slug, musicName, personName, views, publishedAt, createdAt, link_disabled_at")
    .not("mp3Url", "is", null)
    .order("views", { ascending: false })
    .limit(500)

  const orderIds = (musicRows ?? []).map((m) => m.orderId).filter(Boolean)
  const { data: orders } = orderIds.length
    ? await supabase.from("orders").select("id, nome, subcategory, publication_consent, rede_oculta").in("id", orderIds)
    : { data: [] as { id: string; nome: string; subcategory: string; publication_consent: boolean | null; rede_oculta: boolean | null }[] }

  const orderById: Record<string, { nome: string; subcategory: string; publication_consent: boolean | null; rede_oculta: boolean | null }> = {}
  for (const o of orders ?? []) orderById[o.id] = o

  // Denúncias da Rede (migração 066): abertas = aguardando decisão sua;
  // o total ajuda a ver reincidência numa música que você decidiu manter.
  const { data: reports } = await supabase.from("music_reports").select("orderId, motivo, status")
  const denuncias: Record<string, { abertas: number; total: number; motivos: string[] }> = {}
  for (const r of reports ?? []) {
    const d = (denuncias[r.orderId] ??= { abertas: 0, total: 0, motivos: [] })
    d.total++
    if (r.status === "aberta") { d.abertas++; if (!d.motivos.includes(r.motivo)) d.motivos.push(r.motivo) }
  }

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br").replace(/\/$/, "")

  return (musicRows ?? []).map((m) => {
    const order = orderById[m.orderId]
    return {
      id: m.id,
      code: String(m.orderId).slice(0, 8).toUpperCase(),
      orderId: m.orderId,
      nome: order?.nome ?? "—",
      subcategory: order?.subcategory ?? "—",
      musicName: m.musicName,
      personName: m.personName,
      publicationConsent: order?.publication_consent ?? false,
      redeOculta: order?.rede_oculta ?? false,
      denunciasAbertas: denuncias[m.orderId]?.abertas ?? 0,
      denunciasTotal: denuncias[m.orderId]?.total ?? 0,
      motivosAbertos: denuncias[m.orderId]?.motivos ?? [],
      views: m.views ?? 0,
      publishedAt: m.publishedAt ?? m.createdAt,
      linkActive: !!m.slug && !m.link_disabled_at,
      url: m.slug ? `${baseUrl}/m/${m.slug}` : null,
    }
  })
}

export default async function MusicasPage() {
  const musicas = await getMusicas()

  return (
    <div className="p-4 lg:p-8 max-w-5xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Catálogo de músicas</h1>
      <p className="text-gray-500 text-sm mb-8">
        Todas as músicas geradas — ativas ou com link desativado. O MP3/letra nunca são apagados; use este catálogo pra decidir manualmente o que entra numa playlist futura, respeitando o consentimento de publicação de cada pedido.
      </p>
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
        <MusicasList initial={musicas} />
      </div>
    </div>
  )
}
