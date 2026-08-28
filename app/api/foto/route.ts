import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const BUCKET = "order-photos"

// Mesma validade do áudio: sobrevive à visita, morre depois. Foto é
// carregada de uma vez (não tem "arrastar a barra"), então nem precisaria de
// tanto — mas a página de fotos fica aberta enquanto o cliente organiza.
const VALIDADE_SEGUNDOS = 30 * 60

// Porta única das FOTOS DO CLIENTE.
//
// Mesmo problema que o áudio tinha (ver /api/audio): o bucket `order-photos`
// era público e o endereço, permanente — bastava ter a URL pra ver a foto de
// qualquer pedido, para sempre, sem credencial nenhuma.
//
// Aqui é mais sério que a música: foto de família é dado pessoal, e o expurgo
// LGPD apaga as fotos quando o link vence justamente porque elas não deveriam
// sobreviver ao prazo. Um endereço permanente que continua funcionando depois
// disso esvazia o próprio expurgo.
//
// Duas credenciais possíveis, as mesmas que já governam o resto:
// - `slug`  → o link do presente que o próprio cliente compartilha. Se o
//   expurgo desativou o link, a foto para de ser servida junto.
// - `token` → o photo_token do painel de fotos (acesso sem login, é como o
//   cliente organiza as fotos depois de pagar).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const fotoId = sp.get("f")?.trim() || null
  const slug = sp.get("slug")?.trim() || null
  const token = sp.get("token")?.trim() || null
  if (!fotoId || (!slug && !token)) return negar()

  const supabase = createServerClient()

  const { data: foto } = await supabase
    .from("order_photos")
    .select("id, url, orderId")
    .eq("id", fotoId)
    .maybeSingle()
  if (!foto?.url || !foto.orderId) return negar()

  // A credencial precisa apontar para O MESMO pedido da foto — senão bastaria
  // um slug válido qualquer pra ver foto de outro cliente.
  if (slug) {
    const { data } = await supabase
      .from("generated_music")
      .select("orderId, link_disabled_at")
      .eq("slug", slug)
      .maybeSingle()
    if (!data || data.orderId !== foto.orderId || data.link_disabled_at) return negar()
  } else {
    const { data } = await supabase
      .from("orders")
      .select("id")
      .eq("photo_token", token)
      .maybeSingle()
    if (!data || data.id !== foto.orderId) return negar()
  }

  const caminho = caminhoNoBucket(foto.url as string)
  if (!caminho) return negar()

  const { data: assinada, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(caminho, VALIDADE_SEGUNDOS)
  if (error || !assinada?.signedUrl) return negar()

  return NextResponse.redirect(assinada.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  })
}

// O banco guarda a URL pública inteira (decisão de quando o bucket era
// aberto). O caminho é extraído dela em vez de virar coluna nova — evita
// migração e backfill de 229 fotos por um dado que já está ali.
function caminhoNoBucket(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/order-photos\/(.+?)(?:\?|$)/)
  return m ? decodeURIComponent(m[1]) : null
}

// Resposta igual pra "não existe" e "não pode".
function negar() {
  return NextResponse.json({ error: "Imagem indisponível." }, { status: 404 })
}
