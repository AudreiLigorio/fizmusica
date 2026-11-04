import { cache } from "react"
import { unstable_cache } from "next/cache"
import { createServerClient } from "@/lib/supabase"
import { notFound } from "next/navigation"
import PublicMusicPlayer from "./PublicMusicPlayer"
import { getPlanFeatures } from "@/lib/planFeatures"
import { lrcToPlainLyrics } from "@/lib/suno/lrc"
import ContarVisita from "./ContarVisita"

// Esta página é IGUAL para todo mundo — é o link do presente, sem nada do
// visitante — então ela pode ser servida do cache em vez de montada a cada
// abertura.
//
// Antes era `force-dynamic`: cada visita custava uma invocação de função, 5
// consultas e a renderização inteira do player. É a página que os clientes
// mais compartilham, então era o maior gasto de CPU que o projeto tinha. Em
// 04/11 a Vercel pausou o projeto justamente por CPU.
//
// 5 minutos é curto de propósito: quando o expurgo desativa um link
// (`link_disabled_at`), a janela em que a página ainda aparece é pequena — e
// o áudio e as fotos conferem o prazo em toda requisição, então o conteúdo em
// si já para na hora (ver /api/audio e /api/foto).
// `revalidate` SOZINHO não resolve nesta versão do Next, e eu tentei primeiro
// só com ele: o cliente do Supabase busca com `no-store`, e uma busca
// no-store torna a rota dinâmica de novo, anulando o valor. Medido: a página
// continuava saindo com `Cache-Control: no-store` e fora do manifesto de
// revalidação.
//
// A saída é isolar a carga dentro de `unstable_cache`: o que acontece lá
// dentro não contamina o modo de renderização da rota, e o resultado é
// reaproveitado entre requisições.
export const revalidate = 300

// Uma consulta só, compartilhada entre `generateMetadata` e a página.
//
// As duas liam a MESMA linha da mesma tabela, no mesmo request — o título
// buscava `musicName, personName` e logo depois a página buscava a linha
// inteira. `cache()` do React descarta a segunda ida ao banco.
const buscarMusica = cache((slug: string) =>
  unstable_cache(
    async () => {
      const supabase = createServerClient()
      const { data } = await supabase
        .from("generated_music")
        .select("id, musicName, personName, lyrics, lyricsLrc, mp3Url, imageUrl, orderId, link_disabled_at")
        .eq("slug", slug)
        .single()
      return data
    },
    ["player-musica", slug],
    { revalidate: 300 },
  )(),
)

// Resto dos dados do player, no mesmo cache e com a mesma validade. Eram três
// consultas por visita (pedido, fotos e plano) e nenhuma delas muda entre uma
// abertura e outra — o plano é o contratado, as fotos já foram organizadas, e
// o nome do pedido não muda mais.
const carregarResto = cache((orderId: string) =>
  unstable_cache(
    async () => {
      const supabase = createServerClient()
      const [{ data: order }, { data: photoRows }, features] = await Promise.all([
        supabase
          .from("orders")
          .select("nome, context, subcategory, musicalStyle, photo_effect")
          .eq("id", orderId)
          .single(),
        supabase
          .from("order_photos")
          .select("id, url, is_cover, sort_order")
          .eq("orderId", orderId)
          // Foto escondida pelo cliente não vai pro player (migração 070). O
          // corte é aqui, no servidor: o player é a tela de QUEM RECEBE, e o
          // que foi escondido não deve nem sair daqui.
          .eq("oculta", false)
          .order("is_cover", { ascending: false })
          .order("sort_order", { ascending: true }),
        getPlanFeatures(supabase, orderId),
      ])
      return { order, photoRows, features }
    },
    ["player-resto", orderId],
    { revalidate: 300 },
  )(),
)

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await buscarMusica(slug)

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
  const music = await buscarMusica(slug)

  if (!music || !music.mp3Url) notFound()

  // Link desativado (prazo expirado, configurável em Admin → Operação): a obra
  // continua guardada internamente — só o acesso público para de funcionar.
  if (music.link_disabled_at) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6" style={{ background: "#07060d" }}>
        <div>
          <p className="text-3xl mb-3">🔒</p>
          <h1 className="text-xl font-bold text-white mb-2">Este link não está mais disponível</h1>
          <p className="text-white/50 text-sm max-w-sm">O prazo de acesso a esta música expirou.</p>
        </div>
      </div>
    )
  }

  // A contagem de visita saiu daqui: com a página cacheada, este trecho só
  // rodaria quando o cache fosse renovado, e o número despencaria. Agora quem
  // avisa é o navegador, uma vez por abertura (ver <ContarVisita/> no fim).
  // As REPRODUÇÕES não mudam — elas já contavam no cliente, no `onPlay`.

  // Pedido, fotos e recursos do plano — tudo numa ida só, cacheada.
  //
  // O corte do que o plano inclui é feito aqui, no SERVIDOR: o player é a
  // tela do presenteado, e o que o plano não contratou simplesmente não é
  // enviado ao navegador, em vez de ir junto e ficar escondido por CSS.
  const { order, photoRows, features } = await carregarResto(music.orderId)

  // Rota guardada, não o link do arquivo: o bucket order-photos ficou
  // privado. O slug é a credencial — se o expurgo desativar o link, a foto
  // para de ser servida junto (ver /api/foto).
  const photos = (photoRows ?? []).map(
    (p) => `/api/foto?f=${p.id}&slug=${encodeURIComponent(slug)}`,
  )
  const photoEffect = (order?.photo_effect ?? "slide") as "slide" | "fade" | "cards" | "coverflow"

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
  const publicUrl = `${baseUrl}/m/${slug}`

  return (
    <div className="bg-[#07060d] text-white font-sans">
      <PublicMusicPlayer
        music={{
          musicName: music.musicName,
          personName: music.personName,
          // Sem sincronização, a letra continua — só perde o acompanhamento.
          // A maioria das músicas tem só o LRC preenchido (vem pronto do
          // Suno), então aqui os tempos são retirados pra sobrar a letra.
          lyrics: features.letraSincronizada
            ? music.lyrics
            : (music.lyrics?.trim() || (music.lyricsLrc ? lrcToPlainLyrics(music.lyricsLrc) : null)),
          // O LRC nem sai do servidor quando o plano não inclui sincronização.
          lyricsLrc: features.letraSincronizada ? music.lyricsLrc : null,
          // Rota guardada: o slug é a credencial (ver /api/audio).
          mp3Url: `/api/audio?slug=${encodeURIComponent(slug)}`,
          imageUrl: music.imageUrl,
          // Plano sem fotos mostra só a capa — é o que o player faz com a
          // lista vazia (cai no imageUrl).
          photos: features.fotos > 0 ? photos : [],
          photoEffect,
          order: order ?? null,
        }}
        publicUrl={publicUrl}
        mostrarQr={features.qrcode}
      />
      <ContarVisita slug={slug} />
    </div>
  )
}
