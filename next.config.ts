import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Desliga o cache do cliente para o painel sempre mostrar dados frescos
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
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
