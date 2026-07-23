import { ImageResponse } from "next/og"
import { readFile } from "fs/promises"
import path from "path"

// Compõe a imagem final "branded" a partir do fundo gerado pela KIE. O texto e o
// logo são renderizados por NÓS (fonte real, precisão de pixel) — nunca pela IA
// generativa, que erra ortografia e deforma o logo. Isso é o que torna o post
// profissional e confiável.

type Platform = "instagram" | "tiktok" | "youtube"

// Dimensões e identidade por plataforma. O fundo entra com object-fit cover, então
// a proporção que a KIE gerou não precisa bater exatamente com o canvas.
const PLATFORM: Record<Platform, { w: number; h: number; handle: string; cta: string }> = {
  instagram: { w: 1080, h: 1350, handle: "@fiz_musica", cta: "Link na bio" },
  tiktok:    { w: 1080, h: 1920, handle: "@fizmusica",  cta: "Link na bio" },
  youtube:   { w: 1280, h: 720,  handle: "@Fizmusica10", cta: "Link na descrição" },
}

// Cache dos assets em memória (fontes + logo) — lidos uma vez por processo.
let cache: { extraBold: Buffer; semiBold: Buffer; logoDataUri: string } | null = null

async function loadAssets() {
  if (cache) return cache
  const fontsDir = path.join(process.cwd(), "lib/content/fonts")
  const [extraBold, semiBold, logoPng] = await Promise.all([
    readFile(path.join(fontsDir, "DMSans-ExtraBold.ttf")),
    readFile(path.join(fontsDir, "DMSans-SemiBold.ttf")),
    readFile(path.join(process.cwd(), "public/logo_fizmusica.png")),
  ])
  cache = {
    extraBold,
    semiBold,
    logoDataUri: `data:image/png;base64,${logoPng.toString("base64")}`,
  }
  return cache
}

export async function composeBrandedImage(opts: {
  backgroundBytes: Buffer
  hook: string
  platform: string
}): Promise<Buffer> {
  const p = PLATFORM[(opts.platform as Platform)] ?? PLATFORM.instagram
  const { extraBold, semiBold, logoDataUri } = await loadAssets()
  const bgDataUri = `data:image/png;base64,${opts.backgroundBytes.toString("base64")}`

  // Tamanho do gancho relativo à largura, com teto/piso pra não estourar.
  const hookSize = Math.round(Math.min(96, Math.max(52, p.w / (opts.hook.length > 28 ? 13 : 10))))

  const response = new ImageResponse(
    (
      <div style={{ display: "flex", width: p.w, height: p.h, position: "relative" }}>
        {/* Fundo gerado pela KIE (cover) */}
        <img
          src={bgDataUri}
          width={p.w}
          height={p.h}
          style={{ position: "absolute", top: 0, left: 0, width: p.w, height: p.h, objectFit: "cover" }}
        />
        {/* Scrim escuro embaixo pra legibilidade do gancho */}
        <div
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0, height: p.h * 0.62, display: "flex",
            background: "linear-gradient(to top, rgba(10,6,15,0.92) 0%, rgba(10,6,15,0.65) 40%, rgba(10,6,15,0) 100%)",
          }}
        />
        {/* Logo no topo */}
        <img
          src={logoDataUri}
          height={Math.round(p.h * 0.06)}
          style={{ position: "absolute", top: p.h * 0.045, left: p.w * 0.06, height: p.h * 0.06 }}
        />
        {/* Gancho — terço inferior, acima do rodapé */}
        <div
          style={{
            position: "absolute", left: p.w * 0.07, right: p.w * 0.07, bottom: p.h * 0.16, display: "flex",
            fontFamily: "DM Sans ExtraBold", fontSize: hookSize, lineHeight: 1.08, color: "#ffffff",
            textShadow: "0 2px 18px rgba(0,0,0,0.55)", letterSpacing: -1,
          }}
        >
          {opts.hook}
        </div>
        {/* Faixa rodapé com gradiente da marca + handle + CTA */}
        <div
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0, height: p.h * 0.11,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            paddingLeft: p.w * 0.07, paddingRight: p.w * 0.07,
            background: "linear-gradient(90deg, #f0196b 0%, #d946ef 100%)",
            fontFamily: "DM Sans SemiBold", fontSize: Math.round(p.w * 0.036), color: "#ffffff",
          }}
        >
          <div style={{ display: "flex" }}>{p.handle}</div>
          <div style={{ display: "flex" }}>🔗 {p.cta}</div>
        </div>
      </div>
    ),
    {
      width: p.w,
      height: p.h,
      fonts: [
        { name: "DM Sans ExtraBold", data: extraBold, weight: 800, style: "normal" },
        { name: "DM Sans SemiBold", data: semiBold, weight: 600, style: "normal" },
      ],
    },
  )

  return Buffer.from(await response.arrayBuffer())
}
