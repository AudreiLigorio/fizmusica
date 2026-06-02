import { createServerClient } from "@/lib/supabase"
import { notFound } from "next/navigation"
import PublicMusicPlayer from "./PublicMusicPlayer"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data } = await supabase
    .from("generated_music")
    .select("music_name, person_name")
    .eq("slug", slug)
    .single()

  if (!data) return { title: "FizMusica" }

  return {
    title: data.music_name
      ? `${data.music_name} — FizMusica ❤️`
      : `Música especial para ${data.person_name ?? "você"} — FizMusica`,
    description: `Uma música personalizada feita com amor pela FizMusica.`,
  }
}

export default async function PublicMusicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data: music } = await supabase
    .from("generated_music")
    .select(`
      id, music_name, person_name, lyrics, mp3_url, image_url,
      orders ( nome, context, subcategory, musicalStyle )
    `)
    .eq("slug", slug)
    .single()

  if (!music || !music.mp3_url) notFound()

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
  const publicUrl = `${baseUrl}/m/${slug}`

  const order = Array.isArray(music.orders) ? music.orders[0] ?? null : music.orders

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <PublicMusicPlayer
        music={{ ...music, orders: order }}
        publicUrl={publicUrl}
      />
    </div>
  )
}
