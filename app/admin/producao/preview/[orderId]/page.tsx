import { createServerClient } from "@/lib/supabase"
import { urlAssinadaDoAudio } from "@/lib/audioUrl"
import { urlsAssinadas, BUCKET_FOTOS } from "@/lib/mediaUrl"
import { notFound } from "next/navigation"
import Link from "next/link"
import PublicMusicPlayer from "@/app/m/[slug]/PublicMusicPlayer"
import { getPlanFeatures } from "@/lib/planFeatures"
import { lrcToPlainLyrics } from "@/lib/suno/lrc"

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

  // Os buckets songs e order-photos são PRIVADOS: as URLs gravadas não abrem
  // mais sozinhas, e a prévia do admin ficava sem áudio e com as fotos
  // quebradas. Aqui é assinado no servidor porque o admin já passou pelo
  // layout autenticado — a prévia é a tela onde ele confere o que o cliente
  // vai receber, então tem que mostrar exatamente a mesma coisa.
  //
  // O player público de verdade (/m/{slug}) não passa por aqui: ele usa as
  // rotas guardadas /api/audio e /api/foto, cuja credencial é o slug.
  const fotosAssinadas = await urlsAssinadas(supabase, BUCKET_FOTOS, (photoRows ?? []).map((p) => p.url as string))
  const photos = (photoRows ?? []).map((p) => fotosAssinadas.get(p.url as string) ?? (p.url as string))
  const mp3Tocavel = music?.mp3Url ? (await urlAssinadaDoAudio(supabase, music.mp3Url)) ?? music.mp3Url : ""
  const photoEffect = (order.photo_effect ?? "slide") as "slide" | "fade" | "cards" | "coverflow"

  // A prévia serve pra conferir o que o CLIENTE vai ver — então respeita os
  // mesmos recursos do plano. Sem isto, o admin aprovaria uma tela com letra
  // sincronizada e QR que o plano contratado não entrega.
  const features = await getPlanFeatures(supabase, orderId)

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
          // Sem cair pro nome do comprador — senão a prévia mostra um nome que
          // o player de verdade nunca vai ter (pedido legado pode não ter homenageado).
          personName:  music?.personName ?? order.honoreeName ?? null,
          lyrics:      features.letraSincronizada
            ? (music?.lyrics ?? null)
            : (music?.lyrics?.trim() || (music?.lyricsLrc ? lrcToPlainLyrics(music.lyricsLrc) : null)),
          lyricsLrc:   features.letraSincronizada ? (music?.lyricsLrc ?? null) : null,
          mp3Url:      mp3Tocavel,
          imageUrl:    music?.imageUrl ?? null,
          photos: features.fotos > 0 ? photos : [],
          photoEffect,
          order: {
            nome:         order.nome,
            context:      order.context,
            subcategory:  order.subcategory,
            musicalStyle: order.musicalStyle,
          },
        }}
        publicUrl=""
        mostrarQr={features.qrcode}
      />
    </div>
  )
}
