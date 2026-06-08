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
    description: `Uma música personalizada feita com amor pela FizMusica.`,
  }
}

export default async function PublicMusicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data: music } = await supabase
    .from("generated_music")
    .select("id, musicName, personName, lyrics, mp3Url, orderId")
    .eq("slug", slug)
    .single()

  if (!music || !music.mp3Url) notFound()

  // Busca order separadamente (sem JOIN — FK não configurada)
  const { data: order } = await supabase
    .from("orders")
    .select("nome, context, subcategory, musicalStyle")
    .eq("id", music.orderId)
    .single()

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
  const publicUrl = `${baseUrl}/m/${slug}`

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <PublicMusicPlayer
        music={{
          musicName: music.musicName,
          personName: music.personName,
          lyrics: music.lyrics,
          mp3Url: music.mp3Url,
          order: order ?? null,
        }}
        publicUrl={publicUrl}
      />
    </div>
  )
}
