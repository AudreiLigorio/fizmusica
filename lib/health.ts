import { createServerClient } from "@/lib/supabase"

export type ServiceStatus = "ok" | "error" | "not_configured"

export interface ServiceCheck {
  name: string
  status: ServiceStatus
  message: string
  latency_ms?: number
}

export interface HealthReport {
  status: "healthy" | "degraded" | "unhealthy"
  version: string
  timestamp: string
  services: ServiceCheck[]
}

// ──────────────────────────────────────────────
// Database (Supabase PostgreSQL via Prisma)
// ──────────────────────────────────────────────

async function checkDatabase(): Promise<ServiceCheck> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { name: "Database", status: "not_configured", message: "Variáveis do Supabase não configuradas" }
  }

  const supabase = createServerClient()
  const start = Date.now()
  try {
    const { error } = await supabase.from("products").select("id").limit(1)
    if (error) throw error
    return {
      name: "Database",
      status: "ok",
      message: "Supabase PostgreSQL conectado",
      latency_ms: Date.now() - start,
    }
  } catch (err) {
    return {
      name: "Database",
      status: "error",
      message: err instanceof Error ? err.message : "Falha na conexão",
      latency_ms: Date.now() - start,
    }
  }
}

// ──────────────────────────────────────────────
// Email (Resend)
// ──────────────────────────────────────────────

async function checkEmail(): Promise<ServiceCheck> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return { name: "Email", status: "not_configured", message: "RESEND_API_KEY não configurada" }
  }

  const start = Date.now()
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      return { name: "Email", status: "ok", message: "Resend API acessível", latency_ms: Date.now() - start }
    }
    return { name: "Email", status: "error", message: `Resend retornou ${res.status}`, latency_ms: Date.now() - start }
  } catch {
    return { name: "Email", status: "error", message: "Timeout ou falha de rede", latency_ms: Date.now() - start }
  }
}

// ──────────────────────────────────────────────
// Storage (Supabase Storage)
// ──────────────────────────────────────────────

async function checkStorage(): Promise<ServiceCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return {
      name: "Storage",
      status: "not_configured",
      message: "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas",
    }
  }

  const start = Date.now()
  try {
    const res = await fetch(`${url}/storage/v1/bucket`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      return { name: "Storage", status: "ok", message: "Supabase Storage acessível", latency_ms: Date.now() - start }
    }
    return { name: "Storage", status: "error", message: `Storage retornou ${res.status}`, latency_ms: Date.now() - start }
  } catch {
    return { name: "Storage", status: "error", message: "Timeout ou falha de rede", latency_ms: Date.now() - start }
  }
}

// ──────────────────────────────────────────────
// Webhook (n8n)
// ──────────────────────────────────────────────

function checkWebhook(): ServiceCheck {
  const url = process.env.N8N_WEBHOOK_URL
  if (!url) {
    return { name: "Webhook", status: "not_configured", message: "N8N_WEBHOOK_URL não configurada" }
  }
  return { name: "Webhook", status: "ok", message: "n8n webhook configurado" }
}

// ──────────────────────────────────────────────
// Mercado Pago
// ──────────────────────────────────────────────

async function checkMercadoPago(): Promise<ServiceCheck> {
  const token = process.env.MP_ACCESS_TOKEN
  if (!token) {
    return { name: "Pagamentos", status: "not_configured", message: "MP_ACCESS_TOKEN não configurada" }
  }

  const start = Date.now()
  try {
    const res = await fetch("https://api.mercadopago.com/v1/payment_methods", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      return { name: "Pagamentos", status: "ok", message: "Mercado Pago API acessível", latency_ms: Date.now() - start }
    }
    return { name: "Pagamentos", status: "error", message: `MP retornou ${res.status}`, latency_ms: Date.now() - start }
  } catch {
    return { name: "Pagamentos", status: "error", message: "Timeout ou falha de rede", latency_ms: Date.now() - start }
  }
}

// ──────────────────────────────────────────────
// QR Code (biblioteca local — só verifica se disponível)
// ──────────────────────────────────────────────

function checkQrCode(): ServiceCheck {
  try {
    // Valida se a dependência está instalável (será adicionada na Fase 8)
    return { name: "QR Code", status: "not_configured", message: "qrcode lib não instalada ainda (Fase 8)" }
  } catch {
    return { name: "QR Code", status: "not_configured", message: "qrcode lib não instalada" }
  }
}

// ──────────────────────────────────────────────
// Runner principal
// ──────────────────────────────────────────────

export async function runHealthChecks(): Promise<HealthReport> {
  const [db, email, storage, mp] = await Promise.all([
    checkDatabase(),
    checkEmail(),
    checkStorage(),
    checkMercadoPago(),
  ])

  const webhook = checkWebhook()
  const qrCode = checkQrCode()

  const application: ServiceCheck = {
    name: "Application",
    status: "ok",
    message: `Next.js ${process.env.npm_package_version ?? "16"} em execução`,
  }

  const services = [application, db, email, storage, webhook, mp, qrCode]

  const hasError = services.some((s) => s.status === "error")
  const allOk = services.every((s) => s.status === "ok" || s.status === "not_configured")

  const status = hasError ? "degraded" : allOk ? "healthy" : "healthy"

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require("../package.json") as { version: string }

  return {
    status,
    version: pkg.version,
    timestamp: new Date().toISOString(),
    services,
  }
}
