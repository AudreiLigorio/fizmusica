// Funções de baixo nível de ffmpeg — generalização do que validamos em
// scripts/motion-card-test/reveal/render.sh (script manual) pra N cenas
// dinâmicas, chamado pelo worker.ts.
import { execFile } from "child_process"
import { promisify } from "util"

const run = promisify(execFile)

export async function ffmpeg(args: string[]) {
  await run("ffmpeg", ["-y", "-loglevel", "error", ...args], { maxBuffer: 1024 * 1024 * 64 })
}

async function ffmpegCapture(args: string[]): Promise<string> {
  try {
    const { stderr } = await run("ffmpeg", args, { maxBuffer: 1024 * 1024 * 64 })
    return stderr
  } catch (e: any) {
    // ffmpeg -f null escreve no stderr e sai com código não-zero em alguns casos; o texto ainda importa.
    return e.stderr ?? ""
  }
}

// Ken Burns: zoom lento numa imagem estática, gera clipe de vídeo.
export async function renderSceneClip(imagePath: string, w: number, h: number, durationSec: number, fps: number, outPath: string) {
  await ffmpeg([
    "-loop", "1", "-i", imagePath,
    "-vf", `scale=8000:-1,zoompan=z='min(zoom+0.0008,1.1)':d=${Math.round(durationSec * fps)}:s=${w}x${h}:fps=${fps}`,
    "-t", String(durationSec),
    outPath,
  ])
}

// Encadeia N clipes com crossfade (xfade). Retorna a duração total resultante.
export async function concatWithCrossfade(clipPaths: string[], sceneDur: number, xfade: number, outPath: string): Promise<number> {
  const step = sceneDur - xfade
  const inputArgs = clipPaths.flatMap((p) => ["-i", p])
  let filter = ""
  let label = "0"
  for (let i = 1; i < clipPaths.length; i++) {
    const offset = step * i
    const nextLabel = i === clipPaths.length - 1 ? "v" : `v${i}`
    filter += `[${label}][${i}]xfade=transition=fade:duration=${xfade}:offset=${offset}[${nextLabel}];`
    label = nextLabel
  }
  filter = filter.replace(/;$/, "")

  await ffmpeg([...inputArgs, "-filter_complex", filter, "-map", "[v]", outPath])
  return step * (clipPaths.length - 1) + sceneDur
}

// Overlay de N PNGs (legendas por cena + barra de marca), cada um habilitado
// numa janela de tempo, exceto a barra de marca que é 'enable' sempre (sem chave).
export async function overlayPngs(
  videoPath: string,
  overlays: { path: string; enableExpr?: string }[],
  outPath: string,
) {
  const inputs = overlays.flatMap((o) => ["-i", o.path])
  let filter = ""
  let label = "0"
  overlays.forEach((o, i) => {
    const idx = i + 1
    const nextLabel = i === overlays.length - 1 ? "v" : `v${i}`
    const enable = o.enableExpr ? `:enable='${o.enableExpr}'` : ""
    filter += `[${label}][${idx}]overlay=0:0${enable}[${nextLabel}];`
    label = nextLabel
  })
  filter = filter.replace(/;$/, "")

  await ffmpeg(["-i", videoPath, ...inputs, "-filter_complex", filter, "-map", "[v]", outPath])
}

export async function muxAudio(videoPath: string, audioPath: string, trimStart: number, duration: number, outPath: string) {
  const fadeOutStart = Math.max(0, duration - 1.5)
  await ffmpeg([
    "-ss", String(trimStart), "-t", String(duration), "-i", audioPath,
    "-i", videoPath,
    "-af", `afade=t=in:d=1,afade=t=out:st=${fadeOutStart}:d=1.5`,
    "-map", "1:v", "-map", "0:a",
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest",
    outPath,
  ])
}

// Analisa o volume momentâneo (EBU R128) segundo a segundo e acha a janela de
// `windowDur` segundos com maior volume médio — é o "clímax" da música, onde a
// cena final (revelação/ápice) deve cair. Generalização da análise que fiz na
// mão via bash pro exemplo do chá revelação.
export async function detectClimaxStart(audioPath: string, windowDur: number): Promise<number> {
  const out = await ffmpegCapture(["-i", audioPath, "-af", "ebur128=peak=true", "-f", "null", "-"])
  const points: { t: number; m: number }[] = []
  const re = /t:\s*([\d.]+)\s+TARGET.*?M:\s*(-?[\d.]+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(out))) {
    points.push({ t: parseFloat(match[1]), m: parseFloat(match[2]) })
  }
  if (points.length === 0) return 0 // fallback: começo da música

  const totalDur = points[points.length - 1].t
  if (totalDur <= windowDur) return 0

  // Janela deslizante (passo de 1s) — soma o volume (quanto menos negativo,
  // mais alto) dentro de cada janela candidata, pega a de maior média.
  let bestStart = 0
  let bestScore = -Infinity
  for (let start = 0; start <= totalDur - windowDur; start += 1) {
    const inWindow = points.filter((p) => p.t >= start && p.t < start + windowDur && p.m > -60)
    if (inWindow.length === 0) continue
    const score = inWindow.reduce((sum, p) => sum + p.m, 0) / inWindow.length
    if (score > bestScore) { bestScore = score; bestStart = start }
  }
  return bestStart
}
