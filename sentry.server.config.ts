import * as Sentry from "@sentry/nextjs"

// Sem DSN a init é no-op (nada é enviado) — fica inerte até configurar SENTRY_DSN.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Privacidade: não envia IP/cookies/headers automaticamente.
  sendDefaultPii: false,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? "development",
  // Remove o corpo/dados da requisição (podem conter e-mail, história, fotos, etc.).
  beforeSend(event) {
    if (event.request) {
      delete event.request.data
      delete event.request.cookies
      delete (event.request as { headers?: unknown }).headers
    }
    return event
  },
})
