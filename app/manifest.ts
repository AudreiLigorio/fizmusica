import type { MetadataRoute } from "next"

// Manifesto do app instalável — é ele que o Android lê quando o site vira o
// app da Play Store (TWA) ou quando o cliente usa "Adicionar à tela inicial".
//
// `start_url` abre na área do cliente: quem instala app é quem volta (ouvir,
// Rede, Carreira), e o visitante sem conta vê a versão aberta da área, com a
// Rede tocando e o "Criar". O `?origem=app` não é usado pelo site — só deixa
// explícito, nos logs, de onde veio a abertura.
//
// Cores = a paleta escura do site (#07060d): a tela de abertura do Android usa
// `background_color`, e um branco ali piscaria antes do site escuro carregar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Fiz Música",
    short_name: "Fiz Música",
    description: "Músicas personalizadas feitas com amor para quem você ama.",
    lang: "pt-BR",
    start_url: "/minha-musica?origem=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07060d",
    theme_color: "#07060d",
    categories: ["music", "entertainment", "lifestyle"],
    icons: [
      { src: "/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
