// Geolocalização aproximada por IP (ip-api.com, gratuito, sem chave — 45 req/min).
// Usado só pra estimar o estado do cliente em nível agregado/estatístico — não é
// endereço, é uma aproximação baseada na faixa de IP do provedor de internet.

export type GeoResult = { state: string | null; stateName: string | null; city: string | null }

const PRIVATE_IP = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc00:|fe80:)/

export async function lookupState(ip: string | null): Promise<GeoResult> {
  const empty: GeoResult = { state: null, stateName: null, city: null }
  if (!ip || PRIVATE_IP.test(ip)) return empty

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,region,regionName,city`
    )
    const data = await res.json().catch(() => null)
    if (!data || data.status !== "success" || data.countryCode !== "BR") return empty
    return { state: data.region ?? null, stateName: data.regionName ?? null, city: data.city ?? null }
  } catch {
    return empty
  }
}

// Extrai o primeiro IP público de x-forwarded-for (Vercel injeta a cadeia de proxies).
export function extractClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  return headers.get("x-real-ip")
}
