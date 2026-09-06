import { createServerClient } from "@/lib/supabase"
import { notFound } from "next/navigation"
import RedeSongPage from "./RedeSongPage"

export const dynamic = "force-dynamic"

// Página pública de UMA música da Rede Fiz Música.
//
// Por que ela existe: até aqui, compartilhar uma música da Rede era
// impossível. O único link público de uma música é /m/{slug}, e essa página
// MOSTRA AS FOTOS do cliente — o slug é a credencial delas. Por isso o
// /api/catalog parou de devolver slug pra qualquer um: com ele, bastava
// criar conta, ler a resposta e chegar nas fotos de quem publicou.
//
// Então esta rota tem um endereço próprio, e o que ela mostra é só o que a
// Rede já mostra a todo mundo: capa, título, ocasião, apelido (quando o
// autor optou por aparecer) e a letra. NENHUMA foto, em nenhuma hipótese.
//
// O id é o `orderId`, e isso é deliberado, não preguiça de criar uma coluna:
// o /api/catalog já devolve `orderId` a visitante anônimo (é ele que vai em
// `/api/audio?o=`), então publicar esse id não amplia nada — o conjunto de
// ids que circula continua sendo exatamente o das músicas publicadas. Uma
// coluna nova daria a impressão de segredo onde não há, e segredo mal
// entendido foi justamente o que criou o problema do slug.
//
// A trava real está abaixo e é a MESMA do catálogo: publication_consent +
// DELIVERED. Quem revoga a autorização derruba esta página junto.

type Params = { params: Promise<{ id: string }> }

async function carregar(id: string) {
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

export async function generateMetadata({ params }: Params) {
  const { id } = await params
  const dados = await carregar(id)
  if (!dados) return { title: "Fiz Música" }

  // O preview do WhatsApp é o produto aqui: quem recebe o link decide se
  // abre pela imagem e pelo título.
  const descricao = dados.apelido
    ? `${dados.ocasiao} · publicada por ${dados.apelido} na Rede Fiz Música.`
    : `${dados.ocasiao} · publicada na Rede Fiz Música.`

  return {
    title: `${dados.titulo} — Fiz Música`,
    description: descricao,
    openGraph: {
      title: dados.titulo,
      description: descricao,
      images: dados.imageUrl ? [dados.imageUrl] : undefined,
      type: "music.song",
    },
  }
}

export default async function Page({ params }: Params) {
  const { id } = await params
  const dados = await carregar(id)
  if (!dados) notFound()

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"

  return <RedeSongPage dados={dados} publicUrl={`${baseUrl}/rede/${id}`} />
}
