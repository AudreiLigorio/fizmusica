import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getPlanFeatures } from "@/lib/planFeatures"

export const dynamic = "force-dynamic"

// Remove as tags ID3 (v2 no início, v1 no fim) SEM re-encodar. O arquivo cru do Suno
// embute "https://suno.com/song/<id>" na metadata — isso denunciava a origem. O áudio
// (frames MP3) fica intacto; só some a metadata.
function stripId3(buf: Buffer): Buffer {
  let start = 0
  if (buf.length > 10 && buf.toString("ascii", 0, 3) === "ID3") {
    const size =
      ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f)
    start = 10 + size
    if (buf[5] & 0x10) start += 10 // footer presente
  }
  let end = buf.length
  if (buf.length >= 128 && buf.toString("ascii", buf.length - 128, buf.length - 125) === "TAG") {
    end -= 128 // ID3v1 no fim
  }
  return buf.subarray(start, end)
}

// Nome de arquivo ASCII seguro (fallback do Content-Disposition).
function asciiName(raw: string): string {
  return (raw || "musica")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // tira acentos
    .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 60) || "musica"
}

// Entrega o MP3 com um NOME LIMPO ("...- FizMusica.mp3") em vez do caminho do
// storage ("suno-<id>.mp3"), que denunciava a origem. Sem ?audioId, baixa a principal.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const audioId = req.nextUrl.searchParams.get("audioId")
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id, nome, honoreeName, sunoTracks")
    .eq("id", id)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })

  // Plano sem download: esconder o botão não protege nada — esta URL é
  // adivinhável a partir do id do pedido. A recusa precisa ser aqui.
  const features = await getPlanFeatures(supabase, id)
  if (!features.download) {
    return NextResponse.json(
      { error: "O download do MP3 não está incluído no plano contratado." },
      { status: 403 },
    )
  }

  // mp3Url + nome vêm de generated_music (não há coluna mp3Url em orders).
  const { data: gm } = await supabase
    .from("generated_music").select("mp3Url, musicName, personName").eq("orderId", id).maybeSingle()

  // Resolve a URL da faixa: audioId específico → senão a principal (mp3Url) → senão a 1ª.
  const tracks: { audioId: string; audioUrl: string }[] = Array.isArray(order.sunoTracks) ? order.sunoTracks : []
  const picked = audioId ? tracks.find((t) => t.audioId === audioId)?.audioUrl : null
  const srcUrl = picked ?? gm?.mp3Url ?? tracks[0]?.audioUrl ?? null
  if (!srcUrl) return NextResponse.json({ error: "Áudio não encontrado." }, { status: 404 })

  const resp = await fetch(srcUrl)
  if (!resp.ok) return NextResponse.json({ error: "Falha ao obter o áudio." }, { status: 502 })
  const buf = stripId3(Buffer.from(await resp.arrayBuffer()))

  // Nome amigável a partir do título/homenageado/nome (nunca expõe "suno").
  const rawName = gm?.musicName || gm?.personName || order.honoreeName || order.nome || "Minha música"
  const pretty = `${rawName} - FizMusica.mp3`
  const disposition =
    `attachment; filename="${asciiName(rawName)}_FizMusica.mp3"; filename*=UTF-8''${encodeURIComponent(pretty)}`

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": disposition,
      "Content-Length": String(buf.length),
      "Cache-Control": "private, no-store",
    },
  })
}
