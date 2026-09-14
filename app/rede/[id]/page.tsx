import { notFound } from "next/navigation"
import RedeSongPage from "./RedeSongPage"
import { carregarMusicaPublica } from "./dados"

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

export async function generateMetadata({ params }: Params) {
  const { id } = await params
  const dados = await carregarMusicaPublica(id)
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
      // `images` NÃO entra aqui: quem desenha o card é o opengraph-image.tsx
      // deste mesmo segmento, e um `images` explícito no generateMetadata
      // venceria o arquivo e devolveria a capa crua, sem a moldura da marca.
      type: "music.song",
    },
  }
}

export default async function Page({ params }: Params) {
  const { id } = await params
  const dados = await carregarMusicaPublica(id)
  if (!dados) notFound()

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"

  return <RedeSongPage dados={dados} publicUrl={`${baseUrl}/rede/${id}`} />
}
