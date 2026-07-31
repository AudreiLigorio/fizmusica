"use client"

// Rastreamento de comportamento, lado do navegador.
//
// Um id anônimo por visitante (localStorage) só pra ligar os passos de uma
// mesma jornada. A ORIGEM é gravada no primeiro toque e mantida: quem chega
// pelo Instagram, navega e converte três páginas depois continua sendo
// atribuído ao Instagram — atribuir à última página seria dizer que o próprio
// site trouxe a visita.

const CHAVE_SESSAO = "fizmusica_anon"
const CHAVE_ORIGEM = "fizmusica_origem"

type Origem = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  referrer?: string
}

function sessao(): string {
  try {
    let s = localStorage.getItem(CHAVE_SESSAO)
    if (!s) {
      s = crypto.randomUUID()
      localStorage.setItem(CHAVE_SESSAO, s)
    }
    return s
  } catch {
    return "sem-storage"
  }
}

function origem(): Origem {
  try {
    const salva = localStorage.getItem(CHAVE_ORIGEM)
    if (salva) return JSON.parse(salva)

    const p = new URLSearchParams(window.location.search)
    const nova: Origem = {
      utm_source: p.get("utm_source") ?? undefined,
      utm_medium: p.get("utm_medium") ?? undefined,
      utm_campaign: p.get("utm_campaign") ?? undefined,
      utm_content: p.get("utm_content") ?? undefined,
      referrer: document.referrer ? new URL(document.referrer).hostname : undefined,
    }
    // Só grava se houver alguma pista — senão a próxima visita com UTM real
    // ficaria presa a um primeiro toque vazio.
    if (Object.values(nova).some(Boolean)) {
      localStorage.setItem(CHAVE_ORIGEM, JSON.stringify(nova))
    }
    return nova
  } catch {
    return {}
  }
}

export function track(evento: string, detalhe?: string) {
  try {
    const corpo = JSON.stringify({
      sessao: sessao(),
      evento,
      detalhe,
      caminho: window.location.pathname,
      ...origem(),
    })
    // sendBeacon sobrevive à navegação — com fetch normal, o evento de clique
    // que leva pra outra página se perde no meio do caminho.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([corpo], { type: "application/json" }))
    } else {
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo, keepalive: true })
    }
  } catch {
    /* telemetria nunca atrapalha o site */
  }
}
