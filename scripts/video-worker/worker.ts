// Worker local de renderização de vídeo — roda na máquina do usuário porque
// ffmpeg não roda no Vercel. Faz polling em `video_jobs` (o Next.js já gerou
// os ingredientes: imagens de cena via KIE + música via Suno), monta o vídeo
// (Ken Burns + crossfade + texto por cena + detecção automática do clímax da
// música) e sobe o resultado. Ver README.md pra dependências e como rodar.
// As env vars vêm de `node --env-file=.env.local` (ver package.json,
// script "worker:video") — não de dotenv aqui dentro. Import hoisting do
// ESM faria qualquer dotenv.config() neste arquivo rodar TARDE DEMAIS: o
// import de "@/lib/supabase" abaixo é hoisted pro topo do módulo pelo tsx
// e já executa `createClient(...)` antes de qualquer linha deste arquivo
// rodar — confirmado na prática (é exatamente esse bug que isso evita).
import path from "path"
import fs from "fs/promises"
import os from "os"
import { execFile } from "child_process"
import { promisify } from "util"
import { createServerClient } from "@/lib/supabase"
import { logContentEvent } from "@/lib/content/events"
import { purgeVideoIngredients } from "@/lib/content/media"
import {
  renderSceneClip,
  concatWithCrossfade,
  overlayPngs,
  muxAudio,
  detectClimaxStart,
} from "./ffmpeg"

const run = promisify(execFile)
const POLL_MS = 15_000
const SCENE_DUR = 5
const XFADE = 0.6

type Platform = "instagram" | "tiktok" | "youtube"
const CANVAS: Record<Platform, { w: number; h: number; handle: string; cta: string }> = {
  instagram: { w: 1080, h: 1920, handle: "@fiz_musica", cta: "Link na bio" },
  tiktok:    { w: 1080, h: 1920, handle: "@fizmusica",  cta: "Link na bio" },
  youtube:   { w: 1920, h: 1080, handle: "@Fizmusica10", cta: "Link na descrição" },
}

async function download(url: string, dest: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`)
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()))
}

async function processJob(supabase: ReturnType<typeof createServerClient>, job: any) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "video-job-"))
  console.log(`[worker] processando job ${job.id} em ${tmp}`)

  try {
    const recipe = job.recipe
    const scenes: { description: string; caption: string }[] = recipe.scenes
    const platform: Platform = (recipe.platform as Platform) ?? "instagram"
    const canvas = CANVAS[platform] ?? CANVAS.instagram
    const sceneUrls: string[] = job.scene_image_urls

    // 1. Baixa ingredientes
    await Promise.all(sceneUrls.map((url, i) => download(url, path.join(tmp, `scene-${i + 1}.png`))))
    await download(job.song_url, path.join(tmp, "song.mp3"))

    // 2. Ken Burns por cena
    const sceneClips: string[] = []
    for (let i = 0; i < scenes.length; i++) {
      const out = path.join(tmp, `clip-${i + 1}.mp4`)
      await renderSceneClip(path.join(tmp, `scene-${i + 1}.png`), canvas.w, canvas.h, SCENE_DUR, 30, out)
      sceneClips.push(out)
    }

    // 3. Crossfade entre as cenas
    const concatPath = path.join(tmp, "concat.mp4")
    const totalDur = await concatWithCrossfade(sceneClips, SCENE_DUR, XFADE, concatPath)

    // 4. Overlays de texto (Python/Pillow — ffmpeg local não tem drawtext)
    const recipeForOverlays = {
      scenes: scenes.map((s) => ({ caption: s.caption })),
      handle: canvas.handle,
      cta: canvas.cta,
      emphasisColor: [79, 195, 247, 255],
    }
    const recipeJsonPath = path.join(tmp, "recipe.json")
    await fs.writeFile(recipeJsonPath, JSON.stringify(recipeForOverlays))
    await run("python3", [path.join(__dirname, "overlays.py"), recipeJsonPath, tmp, String(canvas.w), String(canvas.h)])

    const step = SCENE_DUR - XFADE
    const overlays = scenes.map((_, i) => ({
      path: path.join(tmp, `cap${i + 1}.png`),
      enableExpr: `between(t,${step * i},${i === scenes.length - 1 ? totalDur : step * (i + 1)})`,
    }))
    overlays.push({ path: path.join(tmp, "brand.png"), enableExpr: undefined as any })
    const withTextPath = path.join(tmp, "withtext.mp4")
    await overlayPngs(concatPath, overlays, withTextPath)

    // 5. Escolhe o trecho do áudio e monta o vídeo final.
    // Música (nova ou do pedido): corta no clímax — a janela de maior volume
    // médio, que é onde o refrão está. Narração: começa do zero, porque a
    // primeira palavra é o começo da frase, não um pico de volume.
    const ehNarracao = (job.recipe as { songSource?: string })?.songSource === "narracao"
    const climaxStart = ehNarracao ? 0 : await detectClimaxStart(path.join(tmp, "song.mp3"), totalDur)
    const finalPath = path.join(tmp, "final.mp4")
    await muxAudio(withTextPath, path.join(tmp, "song.mp3"), climaxStart, totalDur, finalPath)

    // 6. Sobe o resultado
    const bytes = await fs.readFile(finalPath)
    const storagePath = `video-jobs/${job.id}/final.mp4`
    const { error: uploadErr } = await supabase.storage
      .from("content-media")
      .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true })
    if (uploadErr) throw new Error(`Falha ao subir o vídeo: ${uploadErr.message}`)
    const { data: { publicUrl } } = supabase.storage.from("content-media").getPublicUrl(storagePath)

    await supabase.from("video_jobs").update({ status: "concluido", video_url: publicUrl }).eq("id", job.id)
    await supabase.from("content_drafts").update({ video_url: publicUrl }).eq("id", job.contentDraftId)
    await logContentEvent(supabase, job.contentDraftId, "video_concluido", `${scenes.length} cenas, clímax em ${climaxStart.toFixed(1)}s`, "system")

    // As imagens de cena e o MP3 já estão DENTRO do MP4 — guardar os dois é
    // pagar duas vezes pelo mesmo conteúdo. Some com eles assim que o vídeo
    // final sobe (~70% do peso do job). Falhar aqui não invalida o vídeo.
    try {
      const apagados = await purgeVideoIngredients(supabase, job.id)
      if (apagados) console.log(`[worker] ingredientes descartados: ${apagados} arquivo(s)`)
    } catch (e) {
      console.error("[worker] não consegui descartar os ingredientes:", e instanceof Error ? e.message : e)
    }
    console.log(`[worker] job ${job.id} concluído: ${publicUrl}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido ao renderizar."
    console.error(`[worker] job ${job.id} falhou:`, msg)
    await supabase.from("video_jobs").update({ status: "falhou", error: msg }).eq("id", job.id)
    await logContentEvent(supabase, job.contentDraftId, "video_falhou", msg, "system")
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
}

async function tick(supabase: ReturnType<typeof createServerClient>) {
  const { data: job } = await supabase
    .from("video_jobs")
    .select("*")
    .eq("status", "pronto_pra_renderizar")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!job) return

  const { error: claimErr } = await supabase
    .from("video_jobs")
    .update({ status: "renderizando", claimed_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("status", "pronto_pra_renderizar") // evita corrida se dois workers rodarem juntos
  if (claimErr) return

  await processJob(supabase, job)
}

async function main() {
  console.log("[worker] iniciado — verificando video_jobs a cada", POLL_MS / 1000, "segundos. Ctrl+C pra parar.")
  const supabase = createServerClient()
  for (;;) {
    try {
      await tick(supabase)
    } catch (e) {
      console.error("[worker] erro no ciclo:", e instanceof Error ? e.message : e)
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

main()
