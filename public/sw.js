// Service worker do Fiz Música — de propósito, o MÍNIMO possível.
//
// Ele existe por um motivo só: quando o app (ou o site instalado) abre sem
// internet, mostrar uma página "sem conexão" em vez da tela de erro do Chrome.
// Não guarda páginas, scripts nem áudio em cache: um service worker que cacheia
// o site passa a servir versão velha depois de cada deploy, e esse tipo de bug
// (cliente vendo tela antiga sem ninguém saber por quê) é caro de caçar.
//
// Só intercepta NAVEGAÇÃO (abrir/recarregar página). API, Supabase, Mercado
// Pago, áudio e imagens passam direto, como se o service worker não existisse.

const CACHE = "fizmusica-offline-v1"
const OFFLINE = "/offline.html"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll([OFFLINE, "/app/icon-192.png"]))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method === "GET" && new URL(req.url).pathname === "/app/icon-192.png") {
    event.respondWith(fetch(req).catch(() => caches.match(req)))
    return
  }
  if (req.mode !== "navigate") return
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)))
})
