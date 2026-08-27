import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import AuthHashHandler from "./components/AuthHashHandler";
import ChunkReloadGuard from "./components/ChunkReloadGuard"
import Tracker from "@/app/components/Tracker";

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Fiz Música — Sua história. Sua música.",
  description: "Músicas personalizadas feitas com amor para quem você ama.",
};

// viewport-fit=cover faz o env(safe-area-inset-*) valer de verdade. Sem isso
// ele devolve 0, e o padding de área segura da barra de abas e do player era
// letra morta em celular com notch/indicador de home.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${cormorant.variable} ${dmSans.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <AuthHashHandler />
        <Tracker />
        <ChunkReloadGuard />
        {children}
      </body>
    </html>
  );
}
