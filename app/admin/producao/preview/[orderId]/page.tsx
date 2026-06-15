import { createServerClient } from "@/lib/supabase"
import { notFound } from "next/navigation"
import Link from "next/link"
import PublicMusicPlayer from "@/app/m/[slug]/PublicMusicPlayer"

export const dynamic = "force-dynamic"

export default async function ProducaoPreview({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("nome, context, subcategory, musicalStyle, honoreeName, photo_effect")
    .eq("id", orderId)
    .single()

  if (!order) notFound()

  const { data: music } = await supabase
    .from("generated_music")
    .select("musicName, personName, lyrics, lyricsLrc, mp3Url, imageUrl")
    .eq("orderId", orderId)
    .maybeSingle()

  const { data: photoRows } = await supabase
    .from("order_photos")
    .select("url, is_cover, sort_order")
    .eq("orderId", orderId)
    .order("is_cover", { ascending: false })
    .order("sort_order", { ascending: true })

  const photos = (photoRows ?? []).map((p) => p.url as string)
  const photoEffect = (order.photo_effect ?? "slide") as "slide" | "fade" | "cards" | "coverflow"

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Barra de prévia (admin) */}
      <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-between px-4 py-2 bg-black/80 backdrop-blur border-b border-pink-500/30">
        <span className="text-xs font-bold text-pink-400">👁 PRÉVIA — não enviada ao cliente</span>
        <Link href="/admin/producao" className="text-xs text-gray-300 hover:text-white">← Voltar para produção</Link>
      </div>

      <PublicMusicPlayer
        music={{
          musicName:   music?.musicName ?? null,
          personName:  music?.personName ?? order.honoreeName ?? order.nome ?? null,
          lyrics:      music?.lyrics ?? null,
          lyricsLrc:   music?.lyricsLrc ?? null,
          mp3Url:      music?.mp3Url ?? "",
          imageUrl:    music?.imageUrl ?? null,
          photos,
          photoEffect,
          order: {
            nome:         order.nome,
            context:      order.context,
            subcategory:  order.subcategory,
            musicalStyle: order.musicalStyle,
          },
        }}
        publicUrl=""
      />
    </div>
  )
}
