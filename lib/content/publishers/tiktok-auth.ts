// OAuth 2.0 do TikTok — Login Kit (autenticação) e, quando a Content Posting
// API estiver aprovada, também o escopo de publicação. Diferente do
// Instagram (token de 60 dias colado manualmente no env), o access token do
// TikTok dura só 24h: guardamos em `tiktok_auth` (linha única, id=1) e
// renovamos via refresh_token (válido ~365 dias) antes de cada uso.
//
// Docs: https://developers.tiktok.com/doc/login-kit-web
//       https://developers.tiktok.com/doc/oauth-user-access-token-management
import { createServerClient } from "@/lib/supabase"

const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/"
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"

// Cookie do state anti-CSRF, compartilhado entre as rotas login/callback.
export const TIKTOK_STATE_COOKIE = "tiktok_oauth_state"

function clientKey() {
  const v = process.env.TIKTOK_CLIENT_KEY
  if (!v) throw new Error("TIKTOK_CLIENT_KEY não configurado no ambiente.")
  return v
}

function clientSecret() {
  const v = process.env.TIKTOK_CLIENT_SECRET
  if (!v) throw new Error("TIKTOK_CLIENT_SECRET não configurado no ambiente.")
  return v
}

// Pedir um escopo que o app ainda não tem aprovado faz o TikTok recusar a tela
// de autorização inteira — ou seja, ligar `video.publish` cedo demais quebra
// até o login que hoje funciona. Por isso ele entra só quando a Content
// Posting API for aprovada e TIKTOK_PUBLISH_SCOPE=1 for ligado no ambiente.
function scopes(): string {
  const base = ["user.info.basic"]
  if (process.env.TIKTOK_PUBLISH_SCOPE === "1") base.push("video.publish")
  return base.join(",")
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set("client_key", clientKey())
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", scopes())
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("state", state)
  return url.toString()
}

type TokenResponse = {
  open_id: string
  access_token: string
  expires_in: number
  refresh_token: string
  refresh_expires_in: number
  scope: string
  token_type: string
  error?: string
  error_description?: string
}

async function callTokenEndpoint(params: Record<string, string>): Promise<TokenResponse> {
  const body = new URLSearchParams({ client_key: clientKey(), client_secret: clientSecret(), ...params })
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: body.toString(),
  })
  const json = (await res.json()) as TokenResponse
  if (!res.ok || json.error) {
    throw new Error(`TikTok OAuth: ${json.error_description ?? json.error ?? res.statusText}`)
  }
  return json
}

async function storeTokens(t: TokenResponse) {
  const now = Date.now()
  const supabase = createServerClient()
  const { error } = await supabase
    .from("tiktok_auth")
    .upsert({
      id: 1,
      open_id: t.open_id,
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      access_token_expires_at: new Date(now + t.expires_in * 1000).toISOString(),
      refresh_token_expires_at: new Date(now + t.refresh_expires_in * 1000).toISOString(),
      scope: t.scope,
      updated_at: new Date(now).toISOString(),
    })
  if (error) throw new Error(`Falha ao salvar tokens do TikTok: ${error.message}`)
}

// Troca o `code` do callback pelos tokens e já salva no banco.
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<void> {
  const tokens = await callTokenEndpoint({ code, grant_type: "authorization_code", redirect_uri: redirectUri })
  await storeTokens(tokens)
}

export type TiktokConnectionStatus =
  | { connected: false }
  | { connected: true; openId: string; scope: string; expiresAt: string }

// Estado da conexão pra UI (botão "Conectar"/"Conectado como X").
export async function getConnectionStatus(): Promise<TiktokConnectionStatus> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("tiktok_auth")
    .select("open_id, scope, access_token_expires_at, refresh_token, refresh_token_expires_at")
    .eq("id", 1)
    .maybeSingle()

  if (!data?.refresh_token) return { connected: false }
  if (data.refresh_token_expires_at && new Date(data.refresh_token_expires_at) < new Date()) {
    return { connected: false }
  }
  return {
    connected: true,
    openId: data.open_id,
    scope: data.scope,
    expiresAt: data.access_token_expires_at,
  }
}

// Devolve um access token válido, renovando via refresh_token se o atual já
// expirou (ou está perto disso). Lança se nunca foi conectado.
export async function getValidAccessToken(): Promise<string> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("tiktok_auth")
    .select("access_token, refresh_token, access_token_expires_at")
    .eq("id", 1)
    .maybeSingle()

  if (!data?.refresh_token) throw new Error("TikTok não conectado — faça login pelo Login Kit primeiro.")

  const expiresAt = data.access_token_expires_at ? new Date(data.access_token_expires_at).getTime() : 0
  const stillValid = expiresAt - Date.now() > 5 * 60 * 1000 // 5min de folga
  if (stillValid && data.access_token) return data.access_token

  const tokens = await callTokenEndpoint({ grant_type: "refresh_token", refresh_token: data.refresh_token })
  await storeTokens(tokens)
  return tokens.access_token
}
