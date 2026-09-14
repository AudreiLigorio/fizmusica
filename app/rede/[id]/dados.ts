import { createServerClient } from "@/lib/supabase"

// Carregador único da música pública.
//
// Vive fora da página porque a imagem de compartilhamento (opengraph-image)
// precisa EXATAMENTE das mesmas regras: mesma trava de publicação, mesmo
// título liberado, mesmo apelido. Duas cópias divergiriam no pior lugar
// possível — o card que vai pro Instagram mostrando um título que a página
// não mostra.

export async function carregarMusicaPublica(id: string) {
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id, subcategory, musicalStyle, sunoTracks, userId, publication_consent, status")
    .eq("id", id)
    .maybeSingle()

  if (!order || order.publication_consent !== true || order.status !== "DELIVERED") return null

  const { data: music } = await supabase
    .from("generated_music")
    .select("musicName, musicNameConfirmed, lyrics, lyricsLrc, mp3Url")
    .eq("orderId", id)
    .maybeSingle()

  if (!music) return null

  type Track = { audioUrl: string; imageUrl: string | null }
  const tracks = (order.sunoTracks as Track[] | null) ?? []
  const principal = tracks.find((t) => t.audioUrl === music.mp3Url) ?? tracks[0]
  const audioUrl = principal?.audioUrl ?? music.mp3Url ?? null
  if (!audioUrl) return null

  // Apelido: opt-in separado (`mostrar_apelido`). publication_consent
  // autoriza publicar a OBRA; aparecer como autor é outra escolha.
  let apelido: string | null = null
  if (order.userId) {
    const { data: perfil } = await supabase
      .from("profiles").select("apelido, mostrar_apelido").eq("user_id", order.userId).maybeSingle()
    if (perfil?.mostrar_apelido && perfil.apelido?.trim()) apelido = perfil.apelido.trim()
  }

  const { count } = await supabase
    .from("music_plays").select("id", { count: "exact", head: true }).eq("orderId", id)

  // Mesma regra do catálogo: título real só quando o cliente confirmou —
  // a trava existe pra não expor o título escolhido por terceiro.
  const titulo = music.musicName?.trim() && music.musicNameConfirmed
    ? music.musicName.trim()
    : `Uma canção de ${order.subcategory}`

  return {
    orderId: id,
    titulo,
    ocasiao: order.subcategory as string,
    estilo: (order.musicalStyle as string | null) ?? null,
    imageUrl: principal?.imageUrl ?? null,
    lyrics: music.lyrics ?? null,
    lyricsLrc: music.lyricsLrc ?? null,
    apelido,
    plays: count ?? 0,
  }
}

export type MusicaPublica = NonNullable<Awaited<ReturnType<typeof carregarMusicaPublica>>>
