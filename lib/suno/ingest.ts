import type { createServerClient } from "@/lib/supabase"
import { getTimestampedLyrics, type SunoTrack } from "./client"
import { alignedWordsToLrc } from "./lrc"
import { generateMusicTitle } from "@/lib/composer/title"
import { getComposerSettings } from "@/lib/composer/settings"
import { notifyMusicReady, notifyAdminReviewNeeded } from "./notify"
import { logOrderEvent } from "@/lib/orderEvents"

const BUCKET = "songs"
type DB = ReturnType<typeof createServerClient>

type OrderForIngest = {
  id: string
  honoreeName?: string | null
  nome?: string | null
  lyricsDraft?: string | null
}

// Processa o resultado da geração do Suno: baixa as faixas para o bucket, gera o
// LRC sincronizado, título/homenageado, anexa a capa e marca o pedido como READY.
// Reutilizado pelo webhook E pelo fallback de polling (record-info).
export async function ingestSunoResult(
  supabase: DB,
  order: OrderForIngest,
  taskId: string,
  rawTracks: any[],
): Promise<{ ok: boolean; status: "READY" | "FAILED" }> {
  if (!Array.isArray(rawTracks) || rawTracks.length === 0) {
    await supabase.from("orders").update({ sunoStatus: "FAILED", sunoError: "Suno não retornou faixas." }).eq("id", order.id)
    return { ok: false, status: "FAILED" }
  }

  // Baixa cada faixa e salva no bucket songs (URLs do KIE expiram).
  const tracks: SunoTrack[] = []
  for (const t of rawTracks) {
    const srcUrl = t.audio_url ?? t.audioUrl ?? t.stream_audio_url ?? t.streamAudioUrl
    const audioId = t.id ?? t.audioId
    if (!srcUrl || !audioId) continue
    try {
      const resp = await fetch(srcUrl)
      if (!resp.ok) throw new Error(`download ${resp.status}`)
      const buf = Buffer.from(await resp.arrayBuffer())
      const path = `${order.id}/suno-${audioId}.mp3`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: "audio/mpeg", upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
      tracks.push({
        audioId,
        audioUrl: publicUrl,
        imageUrl: t.image_url ?? t.imageUrl ?? null,
        title: t.title ?? null,
        duration: t.duration ?? null,
      })
    } catch (e) {
      console.error("[suno/ingest] falha ao salvar faixa", audioId, e instanceof Error ? e.message : e)
    }
  }

  if (tracks.length === 0) {
    await supabase.from("orders").update({ sunoStatus: "FAILED", sunoError: "Falha ao salvar as faixas geradas." }).eq("id", order.id)
    return { ok: false, status: "FAILED" }
  }

  const first = tracks[0]

  // LRC sincronizado da 1ª faixa (timestamps do Suno, sem marcadores de seção).
  let lyricsLrc: string | null = null
  try {
    const tl: any = await getTimestampedLyrics(taskId, first.audioId)
    const words = tl?.data?.alignedWords
    if (Array.isArray(words) && words.length) lyricsLrc = alignedWordsToLrc(words)
  } catch (e) {
    console.error("[suno/ingest] LRC falhou", e instanceof Error ? e.message : e)
  }

  // Título/homenageado automáticos — só preenche se ainda não houver (respeita edição manual).
  const { data: gmPrev } = await supabase
    .from("generated_music").select("musicName, personName").eq("orderId", order.id).maybeSingle()
  // Sem cair pro nome do próprio comprador: pedido sem homenageado (Música
  // Livre) não tem destinatário nenhum, e esse campo é o que aparece
  // publicamente no player como "uma música especial para...". Cair pro nome
  // de quem comprou exporia um dado que a pessoa escolheu não divulgar.
  const personName = gmPrev?.personName || order.honoreeName || null
  // Sem cair pro nome do homenageado: o título aparece publicamente na Rede
  // Fiz Música, e o homenageado nunca consentiu em ter o nome divulgado.
  // Falhou a IA? Fica sem título — o resto do fluxo já lida com null.
  // No caminho normal esse título já vem preenchido da aprovação da letra,
  // onde o cliente viu e pôde trocar; aqui é só rede de segurança.
  let musicName = gmPrev?.musicName || null
  if (!musicName && order.lyricsDraft) {
    musicName = await generateMusicTitle(order.lyricsDraft)
  }

  await supabase.from("generated_music").upsert({
    orderId: order.id,
    mp3Url: first.audioUrl,
    imageUrl: first.imageUrl,
    ...(lyricsLrc ? { lyricsLrc } : {}),
    ...(personName ? { personName } : {}),
    ...(musicName ? { musicName } : {}),
    updatedAt: new Date().toISOString(),
  }, { onConflict: "orderId" })

  // A capa é SEMPRE a imagem da IA (Suno). Remove a anterior e zera capas das fotos do cliente.
  if (first.imageUrl) {
    try {
      const { data: olds } = await supabase
        .from("order_photos").select("id, storage_path")
        .eq("orderId", order.id).like("storage_path", "%suno-cover%")
      if (olds?.length) {
        await supabase.storage.from("order-photos").remove(olds.map((o) => o.storage_path).filter(Boolean))
        await supabase.from("order_photos").delete().in("id", olds.map((o) => o.id))
      }
      const resp = await fetch(first.imageUrl)
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer())
        const path = `${order.id}/suno-cover-${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage.from("order-photos").upload(path, buf, { contentType: "image/jpeg", upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from("order-photos").getPublicUrl(path)
          const { count } = await supabase.from("order_photos").select("id", { count: "exact", head: true }).eq("orderId", order.id)
          // Zera a capa das fotos do cliente — a capa é sempre a imagem da IA.
          await supabase.from("order_photos").update({ is_cover: false }).eq("orderId", order.id)
          await supabase.from("order_photos").insert({
            orderId: order.id, url: publicUrl, storage_path: path, is_cover: true, sort_order: count ?? 0,
          })
        }
      }
    } catch (e) {
      console.error("[suno/ingest] capa falhou", e instanceof Error ? e.message : e)
    }
  }

  // Modo "auto" (Operação): libera direto pro cliente, sem passar pelo admin.
  // "review"/"manual": fica READY aguardando o admin clicar em "Liberar versões".
  const { sunoMode } = await getComposerSettings()
  const finalStatus = sunoMode === "auto" ? "RELEASED" : "READY"
  await supabase.from("orders").update({ sunoStatus: finalStatus, sunoError: null, sunoTracks: tracks }).eq("id", order.id)
  await logOrderEvent(supabase, order.id, "musica_gerada", `${tracks.length} versão(ões)`, "system")
  // Modo automático libera direto → avisa o cliente. Modo com aprovação → avisa o ADMIN
  // que há uma música pronta esperando ser liberada.
  if (finalStatus === "RELEASED") {
    await logOrderEvent(supabase, order.id, "musica_liberada", "liberação automática", "system")
    await notifyMusicReady(supabase, order.id)
  } else {
    await notifyAdminReviewNeeded(supabase, order.id)
  }
  return { ok: true, status: "READY" }
}
