import { createServerClient } from "@/lib/supabase"

const BUCKETS = ["order-photos", "product-images", "songs"] as const

// Limite do Storage no plano Free do Supabase (1 GB). Ajustar se o plano mudar.
export const STORAGE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024

async function sumBucket(bucket: string): Promise<number> {
  const supabase = createServerClient()
  let total = 0

  async function walk(prefix: string) {
    const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 })
    for (const item of data ?? []) {
      if (item.id === null) {
        // pasta — desce recursivamente
        await walk(prefix ? `${prefix}/${item.name}` : item.name)
      } else if (item.metadata?.size != null) {
        total += item.metadata.size as number
      }
    }
  }

  await walk("")
  return total
}

// Estima daqui a quantos dias o Storage estoura, com base no ritmo de fotos/músicas
// dos últimos 30 dias (proxy — não temos histórico diário do Storage em si).
async function estimateDaysToFull(totalBytes: number, photoBytes: number, songBytes: number) {
  const supabase = createServerClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ count: totalPhotos }, { count: recentPhotos }] = await Promise.all([
    supabase.from("order_photos").select("id", { count: "exact", head: true }),
    supabase.from("order_photos").select("id", { count: "exact", head: true }).gte("created_at", since),
  ])
  const [{ count: totalSongs }, { count: recentSongs }] = await Promise.all([
    supabase.from("generated_music").select("id", { count: "exact", head: true }).not("mp3Url", "is", null),
    supabase.from("generated_music").select("id", { count: "exact", head: true }).not("mp3Url", "is", null).gte("createdAt", since),
  ])

  const avgPhoto = totalPhotos ? photoBytes / totalPhotos : 0
  const avgSong  = totalSongs  ? songBytes  / totalSongs  : 0
  const growth30d = (recentPhotos ?? 0) * avgPhoto + (recentSongs ?? 0) * avgSong
  const dailyGrowth = growth30d / 30

  if (dailyGrowth <= 0) return null
  const remaining = STORAGE_LIMIT_BYTES - totalBytes
  if (remaining <= 0) return 0
  return Math.round(remaining / dailyGrowth)
}

export async function getStorageUsage() {
  const perBucket = await Promise.all(BUCKETS.map((b) => sumBucket(b)))
  const totalBytes = perBucket.reduce((a, b) => a + b, 0)
  const byName = Object.fromEntries(BUCKETS.map((name, i) => [name, perBucket[i]]))

  const daysToFull = await estimateDaysToFull(totalBytes, byName["order-photos"], byName["songs"])

  return {
    totalBytes,
    limitBytes: STORAGE_LIMIT_BYTES,
    percent: Math.min(100, Math.round((totalBytes / STORAGE_LIMIT_BYTES) * 1000) / 10),
    buckets: BUCKETS.map((name, i) => ({ name, bytes: perBucket[i] })),
    daysToFull,
  }
}
