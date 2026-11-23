"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"
import { META_PIXEL_ID } from "@/lib/metaPixel"

// Carrega o Meta Pixel depois da hidratação (afterInteractive): o visitante do
// anúncio chega pelo navegador do Instagram, no 4G, e a primeira tela não pode
// esperar script de terceiro.
//
// O snippet é o oficial da Meta com duas diferenças: NÃO dispara PageView
// sozinho (quem dispara é o Tracker, a cada troca de página — o oficial só
// contaria a primeira, porque o site navega sem recarregar) e esvazia a fila de
// eventos que chegaram antes dele (ver lib/metaPixel.ts).
export default function MetaPixel() {
  const pathname = usePathname()
  if (!META_PIXEL_ID) return null
  // Painel administrativo não é público de anúncio.
  if (pathname?.startsWith("/admin")) return null

  const id = JSON.stringify(META_PIXEL_ID)
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${id});
(window.__fbqPendentes||[]).forEach(function(a){fbq.apply(null,a)});
window.__fbqPendentes=[];`}
    </Script>
  )
}
