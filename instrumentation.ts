import * as Sentry from "@sentry/nextjs"

// Carrega o config do Sentry conforme o runtime (Node nas rotas/server, Edge no middleware).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

// Captura erros de renderização de rota (App Router) no Sentry.
export const onRequestError = Sentry.captureRequestError
