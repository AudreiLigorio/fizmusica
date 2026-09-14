import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { carregarMusicaPublica } from "./dados"

// Card de compartilhamento da música na Rede.
//
// Por que gerar em vez de mandar a capa crua: a capa sozinha não diz o que é
// aquilo. O card emoldura a arte com a marca, o título e a assinatura do
// autor — e, principalmente, passa pelas MESMAS travas da página (o loader é
// compartilhado). Isso importa mais do que parece: o título só é liberado
// quando `musicNameConfirmed`, porque o que vem do Suno costuma ser o nome do
// homenageado. Um card montado por fora dessa regra publicaria no Instagram o
// nome de alguém que nunca consentiu.
//
// Música sem capa cai no gradiente da marca. Música despublicada não tem card:
// o loader devolve null e o pedido some junto com a página.

export const alt = "Música publicada na Rede Fiz Música"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const dynamic = "force-dynamic"

const ROSA = "#f0196b"
const ROXO = "#d946ef"

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dados = await carregarMusicaPublica(id)

  const fontsDir = path.join(process.cwd(), "lib/content/fonts")
  const [extraBold, semiBold, logoPng] = await Promise.all([
    readFile(path.join(fontsDir, "DMSans-ExtraBold.ttf")),
    readFile(path.join(fontsDir, "DMSans-SemiBold.ttf")),
    readFile(path.join(process.cwd(), "public/logo_fizmusica.png")),
  ])
  const logo = `data:image/png;base64,${logoPng.toString("base64")}`

  // A capa entra embutida, não por URL: o renderizador busca a imagem por
  // fora e uma falha de rede sairia como card quebrado, sem aviso.
  let capa: string | null = null
  if (dados?.imageUrl) {
    try {
      const r = await fetch(dados.imageUrl)
      if (r.ok) {
        const tipo = r.headers.get("content-type") ?? "image/jpeg"
        capa = `data:${tipo};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`
      }
    } catch { /* sem capa: cai no gradiente */ }
  }

  const titulo = dados?.titulo ?? "Rede Fiz Música"
  const linha = dados ? [dados.ocasiao, dados.apelido].filter(Boolean).join(" · ") : "Músicas feitas para pessoas reais"

  const fonte = { style: "normal" as const }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#07060d", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(900px 500px at 12% 8%, rgba(240,25,107,0.22), transparent 60%), radial-gradient(700px 500px at 96% 96%, rgba(217,70,239,0.18), transparent 60%)`, display: "flex" }} />

        <div style={{ display: "flex", width: "100%", height: "100%", padding: 64, alignItems: "center", gap: 56 }}>
          <div style={{ width: 400, height: 400, borderRadius: 32, display: "flex", overflow: "hidden", background: `linear-gradient(135deg, ${ROSA}, ${ROXO})`, border: "1px solid rgba(255,255,255,0.14)" }}>
            {capa && <img src={capa} width={400} height={400} style={{ objectFit: "cover" }} />}
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 26 }}>
              <img src={logo} height={40} />
              <span style={{ fontFamily: "DMSemi", fontSize: 22, color: "rgba(255,255,255,0.45)", letterSpacing: 2 }}>REDE FIZ MÚSICA</span>
            </div>

            <div style={{ fontFamily: "DMExtra", fontSize: titulo.length > 34 ? 60 : 76, color: "#fff", lineHeight: 1.06, marginBottom: 22, display: "flex" }}>
              {titulo}
            </div>

            <div style={{ fontFamily: "DMSemi", fontSize: 28, color: "rgba(255,255,255,0.6)", display: "flex" }}>{linha}</div>

            <div style={{ display: "flex", marginTop: 40 }}>
              <div style={{ display: "flex", background: `linear-gradient(135deg, ${ROSA}, ${ROXO})`, color: "#fff", fontFamily: "DMSemi", fontSize: 26, padding: "14px 30px", borderRadius: 999 }}>
                ▶  Ouvir de graça
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "DMExtra", data: extraBold, weight: 800, ...fonte },
        { name: "DMSemi", data: semiBold, weight: 600, ...fonte },
      ],
    },
  )
}
