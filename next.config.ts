import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Fotos do cliente vêm do storage público do Supabase. Liberar o host aqui
  // permite servi-las por next/image, que entrega no tamanho da tela e em
  // formato moderno — inclusive as que já foram enviadas antes da compressão
  // no upload existir (pedidos entregues não têm como voltar atrás).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
    // As fotos do cliente passaram a ser servidas por /api/foto (bucket
    // order-photos ficou privado). O Next 16 EXIGE declarar caminhos locais
    // com query string — sem isto o otimizador responde 400 e a foto some do
    // player. `search: ""` liberaria tudo; aqui o padrão restringe ao formato
    // real da rota, que é o que a doc recomenda contra enumeração.
    localPatterns: [
      { pathname: "/api/foto" },
      // Demais imagens locais (logo, artes da carreira) continuam liberadas —
      // declarar localPatterns bloqueia todo o resto por padrão.
      { pathname: "/**", search: "" },
    ],
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
