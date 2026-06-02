const COOKIE_NAME = "fizmusica_admin"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 dias

function getSecret() {
  return process.env.ADMIN_SECRET ?? "fizmusica_dev_secret"
}

async function hmac(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function createAdminToken(): Promise<string> {
  const ts = Math.floor(Date.now() / 1000).toString()
  const sig = await hmac(ts, getSecret())
  return `${ts}.${sig}`
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  const [ts, sig] = token.split(".")
  if (!ts || !sig) return false

  const age = Math.floor(Date.now() / 1000) - parseInt(ts, 10)
  if (age > COOKIE_MAX_AGE) return false

  const expected = await hmac(ts, getSecret())
  // timing-safe compare
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}

export { COOKIE_NAME, COOKIE_MAX_AGE }
