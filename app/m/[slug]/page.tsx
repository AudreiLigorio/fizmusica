import { createServerClient } from "@/lib/supabase"
import { notFound } from "next/navigation"
import PublicMusicPlayer from "./PublicMusicPlayer"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data } = await supabase
    .from("generated_music")
    .select("musicName, personName")
    .eq("slug", slug)
    .single()

  if (!data) return { title: "FizMusica" }

  return {
    title: data.musicName
      ? `${data.musicName} — FizMusica ❤️`
      : `Música especial para ${data.personName ?? "você"} — FizMusica`,
    description: `Uma música criada especialmente para você.`,
  }
}

export default async function PublicMusicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data: music } = await supabase
    .from("generated_music")
    .select("id, musicName, personName, lyrics, lyricsLrc, mp3Url, imageUrl, orderId")
    .eq("slug", slug)
    .single()

  if (!music || !music.mp3Url) notFound()

  // Conta o acesso (best-effort, não bloqueia a renderização)
  supabase.rpc("increment_music_views", { p_slug: slug }).then(() => {}, () => {})

  // Busca order separadamente (sem JOIN — FK não configurada)
  const { data: order } = await supabase
    .from("orders")
    .select("nome, context, subcategory, musicalStyle, photo_effect")
    .eq("id", music.orderId)
    .single()

  // Fotos do cliente (capa primeiro) para o carrossel do player
  const { data: photoRows } = await supabase
    .from("order_photos")
    .select("url, is_cover, sort_order")
    .eq("orderId", music.orderId)
    .order("is_cover", { ascending: false })
    .order("sort_order", { ascending: true })

  const photos = (photoRows ?? []).map((p) => p.url as string)
  const photoEffect = (order?.photo_effect ?? "slide") as "slide" | "fade" | "cards" | "coverflow"

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
  const publicUrl = `${baseUrl}/m/${slug}`

  return (
    <div className="bg-[#07060d] text-white font-sans">
      <PublicMusicPlayer
        music={{
          musicName: music.musicName,
          personName: music.personName,
          lyrics: music.lyrics,
          lyricsLrc: music.lyricsLrc,
          mp3Url: music.mp3Url,
          imageUrl: music.imageUrl,
          photos,
          photoEffect,
          order: order ?? null,
        }}
        publicUrl={publicUrl}
      />
    </div>
  )
}
