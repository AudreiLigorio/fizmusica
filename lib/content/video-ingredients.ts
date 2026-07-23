import type { createServerClient } from "@/lib/supabase"
import { generateImage, getImageTaskResult } from "@/lib/content/kie-image"
import { generateMusic, getMusicDetails } from "@/lib/suno/client"
import { generateSongLyrics } from "@/lib/content/song-lyrics"
import { logContentEvent } from "@/lib/content/events"

type DB = ReturnType<typeof createServerClient>

export type VideoScene = { description: string; caption: string }
export type VideoRecipe = {
  scenes: VideoScene[]
  songTheme: string
  songStyle: string
  platform: string
}

// Cria o job e dispara a geração assíncrona dos ingredientes (N imagens KIE +
// letra/música Suno). Não monta o vídeo — isso é trabalho do worker local
// (ffmpeg não roda no Vercel). Ver scripts/video-worker/README.md.
export async function createVideoJob(supabase: DB, draftId: string, recipe: VideoRecipe) {
  if (recipe.scenes.length < 3 || recipe.scenes.length > 6) {
    throw new Error("A receita precisa ter entre 3 e 6 cenas.")
  }

  const { data: job, error } = await supabase
    .from("video_jobs")
    .insert({ contentDraftId: draftId, status: "gerando_ingredientes", recipe })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await logContentEvent(supabase, draftId, "rascunho_criado", "vídeo: ingredientes solicitados")

  // Dispara as N imagens de cena (fotorrealistas, sem texto — o texto é
  // sobreposto depois pelo worker, mesmo princípio do post estático).
  const imageTaskIds = await Promise.all(
    recipe.scenes.map((scene) =>
      generateImage({
        prompt:
          `Fotografia realista, estilo editorial/lifestyle, câmera DSLR, luz natural. Pessoas ` +
          `brasileiras com pele e expressões naturais e genuínas, nada de aparência 3D ou pintura ` +
          `digital — parece uma foto tirada de verdade, não uma ilustração. ${scene.description}. ` +
          `NÃO escreva nenhum texto, palavra ou legenda na imagem.`,
        aspectRatio: "2:3",
      }),
    ),
  )

  // Dispara a letra (Gemini) + música (Suno).
  const { title, lyrics } = await generateSongLyrics(recipe.songTheme, recipe.songStyle)
  const songTaskId = await generateMusic({
    prompt: lyrics,
    style: recipe.songStyle,
    title,
    vocalGender: "f",
    model: "V5",
    callBackUrl: "https://fizmusica.com.br/api/suno/callback-not-used-polling-instead",
  })

  await supabase
    .from("video_jobs")
    .update({ scene_image_task_ids: imageTaskIds, song_task_id: songTaskId })
    .eq("id", job.id)

  return { ...job, scene_image_task_ids: imageTaskIds, song_task_id: songTaskId }
}

// Consulta o progresso dos ingredientes; quando tudo estiver pronto, baixa e
// sobe pro bucket content-media e marca o job como pronto pro worker renderizar.
export async function syncVideoIngredients(supabase: DB, jobId: string) {
  const { data: job } = await supabase.from("video_jobs").select("*").eq("id", jobId).maybeSingle()
  if (!job) throw new Error("Job não encontrado.")
  if (job.status !== "gerando_ingredientes") return job

  const imageTaskIds: string[] = job.scene_image_task_ids ?? []
  const imageResults = await Promise.all(imageTaskIds.map((id) => getImageTaskResult(id)))

  const anyImageFailed = imageResults.some((r) => r.state === "fail")
  if (anyImageFailed) {
    const msg = "Falha ao gerar uma ou mais imagens de cena."
    await supabase.from("video_jobs").update({ status: "falhou", error: msg }).eq("id", jobId)
    await logContentEvent(supabase, job.contentDraftId, "imagem_falhou", msg)
    return { ...job, status: "falhou", error: msg }
  }

  const imagesReady = imageResults.every((r) => r.state === "success")
  const songDetails: any = await getMusicDetails(job.song_task_id)
  const songStatus = songDetails?.data?.status
  const songReady = songStatus === "SUCCESS"

  if (songStatus && /FAIL|ERROR|SENSITIVE/i.test(songStatus)) {
    const msg = `Falha ao gerar a música (${songStatus}).`
    await supabase.from("video_jobs").update({ status: "falhou", error: msg }).eq("id", jobId)
    return { ...job, status: "falhou", error: msg }
  }

  if (!imagesReady || !songReady) return job // ainda gerando

  // Baixa tudo e sobe pro bucket (URLs temporárias da KIE/Suno expiram).
  const sceneImageUrls = await Promise.all(
    imageResults.map(async (r, i) => {
      const bytes = Buffer.from(await (await fetch(r.imageUrl!)).arrayBuffer())
      const path = `video-jobs/${jobId}/scene-${i + 1}.png`
      const { error: upErr } = await supabase.storage
        .from("content-media")
        .upload(path, bytes, { contentType: "image/png", upsert: true })
      if (upErr) throw new Error(`Falha ao subir imagem de cena: ${upErr.message}`)
      return supabase.storage.from("content-media").getPublicUrl(path).data.publicUrl
    }),
  )

  const track = songDetails?.data?.response?.sunoData?.[0]
  if (!track?.audioUrl) throw new Error("Suno não retornou áudio.")
  const songBytes = Buffer.from(await (await fetch(track.audioUrl)).arrayBuffer())
  const songPath = `video-jobs/${jobId}/song.mp3`
  const { error: songUpErr } = await supabase.storage
    .from("content-media")
    .upload(songPath, songBytes, { contentType: "audio/mpeg", upsert: true })
  if (songUpErr) throw new Error(`Falha ao subir a música: ${songUpErr.message}`)
  const songUrl = supabase.storage.from("content-media").getPublicUrl(songPath).data.publicUrl

  const { data: updated, error } = await supabase
    .from("video_jobs")
    .update({ scene_image_urls: sceneImageUrls, song_url: songUrl, status: "pronto_pra_renderizar" })
    .eq("id", jobId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await logContentEvent(supabase, job.contentDraftId, "imagem_gerada", "vídeo: ingredientes prontos, aguardando worker")
  return updated
}
