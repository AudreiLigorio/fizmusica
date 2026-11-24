"use client"

import { pixelDoFunil } from "@/lib/metaPixel"

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

export function idDeSessao(): string {
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

// Diferente da origem (primeiro toque, fica gravada), o CANAL é de cada evento:
// a mesma pessoa pode ter chegado pelo Instagram no navegador e hoje abrir pelo
// app. "app" = site aberto como app instalado (o TWA da Play Store abre em modo
// standalone e manda o referrer android-app://).
function canal(): "app" | "web" {
  try {
    if (document.referrer.startsWith("android-app://")) return "app"
    if (window.matchMedia("(display-mode: standalone)").matches) return "app"
  } catch { /* segue como web */ }
  return "web"
}

export function track(evento: string, detalhe?: string) {
  // Os passos que importam pro anúncio também vão pro Meta Pixel (desligado
  // sem NEXT_PUBLIC_META_PIXEL_ID). Mesmo ponto de disparo de propósito: o
  // funil do admin e o do Instagram contam a mesma coisa.
  pixelDoFunil(evento, detalhe)
  try {
    const corpo = JSON.stringify({
      sessao: idDeSessao(),
      evento,
      detalhe,
      caminho: window.location.pathname,
      canal: canal(),
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

/**
 * Sinal de presença: um batimento por minuto enquanto a aba estiver VISÍVEL.
 *
 * Sem isto, "quem está online" seria mentira — o rastreador só dispara quando a
 * pessoa navega ou clica, então alguém lendo a mesma página por dez minutos
 * sumiria da lista no primeiro segundo. A checagem de visibilidade evita contar
 * aba esquecida aberta em segundo plano como gente olhando o site.
 */
export function iniciarPresenca(): () => void {
  let timer: ReturnType<typeof setInterval> | null = null

  // ── Saída: quanto tempo ficou e até onde rolou ──
  // O ping só bate ao abrir e a cada 60s, então "saiu em 3s" e "saiu em 50s"
  // eram iguais nos dados (24/11/2026: quase todo o anúncio pamela-v4 caía
  // aí). Ao esconder a aba (fechar, voltar pro Instagram, trocar de app)
  // manda `saida` com "12s 40%": segundos nesta página e a maior rolagem.
  // A rolagem é medida em QUALQUER elemento (captura): no celular o wizard
  // rola uma div própria, não a janela.
  const inicio = Date.now()
  let rolagem = 0
  let saiu = false
  const aoRolar = (e: Event) => {
    const el = e.target === document ? document.scrollingElement : (e.target as Element | null)
    if (!el || el.scrollHeight <= el.clientHeight + 4) return
    const p = Math.min(100, Math.round(((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100))
    if (p > rolagem) rolagem = p
  }
  const sair = () => {
    if (saiu) return
    saiu = true
    track("saida", `${Math.round((Date.now() - inicio) / 1000)}s ${rolagem}%`)
  }

  const bater = () => {
    if (document.visibilityState === "visible") {
      saiu = false
      track("ping")
    } else sair()
  }

  track("ping")
  timer = setInterval(() => { if (document.visibilityState === "visible") track("ping") }, 60_000)
  document.addEventListener("visibilitychange", bater)
  document.addEventListener("scroll", aoRolar, { capture: true, passive: true })
  window.addEventListener("pagehide", sair)

  return () => {
    if (timer) clearInterval(timer)
    document.removeEventListener("visibilitychange", bater)
    document.removeEventListener("scroll", aoRolar, { capture: true })
    window.removeEventListener("pagehide", sair)
  }
}
