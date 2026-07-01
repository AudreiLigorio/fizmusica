import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Desliga o cache do cliente das rotas dinâmicas para o painel sempre mostrar
  // dados frescos. (static tem mínimo de 30s no Next 16, então não o forçamos.)
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

// Envelopa com o Sentry. Sem SENTRY_AUTH_TOKEN o upload de source maps é pulado,
// então o build local/CI não quebra; o monitoramento em si ativa com o DSN.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
