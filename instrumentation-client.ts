import * as Sentry from "@sentry/nextjs"

// Sentry no browser (React/Next). Inerte sem NEXT_PUBLIC_SENTRY_DSN.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  // Session Replay DESLIGADO por padrão (privacidade — grava a tela do usuário).
  // Ativar só depois, com mascaramento de inputs/PII configurado.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
