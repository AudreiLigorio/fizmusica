"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"
import QRModal from "@/app/components/QRModal"
import PreparoFlow from "./PreparoFlow"
import DetalhesPedido from "./DetalhesPedido"
import AjudaCliente from "./AjudaCliente"
import PublicacaoConsent from "./PublicacaoConsent"
import EscolherVersao from "./EscolherVersao"
import VersoesEntregues from "./VersoesEntregues"
import DatasEspeciais from "./DatasEspeciais"
import ReferirAmigos from "./ReferirAmigos"
import MinhasMusicas, { type LibraryTrack } from "./MinhasMusicas"
import RedeFizMusica from "./RedeFizMusica"
import { PlayerProvider } from "./PlayerContext"
import { ToastProvider } from "./ToastContext"
import MiniPlayer from "./MiniPlayer"
import InfoTooltip from "./InfoTooltip"
import { TabBarMobile, TabsDesktop, type Aba } from "./AreaTabs"
import FaixaAtalhos from "./FaixaAtalhos"
import BuscaMusicas from "./BuscaMusicas"
import CarreiraPainel from "./CarreiraPainel"
import { dbTime } from "@/lib/date"
import type { PlanFeatures } from "@/lib/planFeatures"

// Pedido antigo/sem produto vem sem `features` da API — libera tudo, mesma
// regra do servidor: dado faltando não pode cancelar recurso já pago.
const TUDO: PlanFeatures = { fotos: 10, letraSincronizada: true, qrcode: true, download: true, revisao: true }

type Order = {
  id: string
  nome?: string
  email?: string
  whatsapp?: string
  context: string
  subcategory: string
  musicalStyle?: string
  voiceType?: string
  emotion?: string
  honoreeName?: string | null
  status: string
  paymentStatus: string
  createdAt: string
  photo_token?: string | null
  slug?: string | null
  products?: { name: string; price: number } | null
  features?: PlanFeatures
  payments?: { amount: number; mpStatus: string | null; paidAt?: string | null } | null
  revision?: { status: string } | null
  is_revision?: boolean
  mp3Url?: string | null
  lyrics?: string | null
  lyricsLrc?: string | null
  sharing_term_accepted_at?: string | null
  lyricsApproved?: boolean
  photoCount?: number
  productId?: string | null
  musicStatus?: string | null
  tracks?: { audioId: string; audioUrl: string; imageUrl: string | null; title: string | null; duration: number | null }[] | null
  publication_consent?: boolean
  answers?: { question: string; answer: string; position: number }[]
  shipping_name?: string | null
  shipping_cep?: string | null
  shipping_address?: string | null
  shipping_number?: string | null
  shipping_complement?: string | null
  shipping_neighborhood?: string | null
  shipping_city?: string | null
  shipping_state?: string | null
  shipping_phone?: string | null
}

type StepState = "done" | "current" | "todo"

// Jornada do cliente pós-pagamento. Cada passo é um ESTADO REAL do pedido —
// se não dá pra derivar de uma flag, não vira passo.
//
// "Versão" (escolher entre as 2 faixas do Suno) existe porque é ação pendente
// do cliente: antes ela não aparecia e o stepper seguia marcando "Produção",
// que já tinha terminado. "Fotos" saiu porque travam na aprovação da letra
// (ver o card de produção abaixo) — destacar um passo que não dá mais pra
// executar confunde em vez de guiar. Elas seguem editáveis depois da entrega,
// na aba Fotos de VersoesEntregues.
const JOURNEY = [
  { key: "pago",    label: "Pagamento", icon: "💳" },
  { key: "letra",   label: "Letra",     icon: "✍️" },
  { key: "prod",    label: "Produção",  icon: "🎵" },
  { key: "versao",  label: "Versão",    icon: "🎚️" },
  { key: "entrega", label: "Entrega",   icon: "✅" },
]

// Versões liberadas e ainda sem escolha (sem slug). Mesma regra usada no card;
// vive aqui pra que o stepper e o conteúdo nunca discordem sobre o estado.
function escolhaPendenteDe(order: Order): boolean {
  return order.paymentStatus === "PAID"
    && order.musicStatus === "RELEASED"
    && !order.slug
    && (order.tracks?.length ?? 0) > 0
}

// Índice da etapa ATUAL (foco).
function currentStepIndex(order: Order): number {
  if (order.status === "DELIVERED") return 4                  // Entrega
  if (escolhaPendenteDe(order)) return 3                      // Versão (ação do cliente)
  if (!order.lyricsApproved) return 1                         // Letra (bloqueante)
  return 2                                                    // Em produção / espera
}

// Precisa da ação do cliente AGORA — vira card grande no topo, sem aba.
// Não pago (ainda não abandonado), letra pendente, escolha de versão
// pendente ou termo de entrega pendente. Tudo o mais (em produção,
// entregue) vira capinha no carrossel. Abandonado não aparece em lugar
// nenhum aqui — isso já é coberto pelo e-mail de recuperação.
function precisaAcao(order: Order): boolean {
  const paid = order.paymentStatus === "PAID"
  if (!paid) return order.status !== "ABANDONED"
  const delivered = order.status === "DELIVERED"
  const approved  = !!order.lyricsApproved
  const termAccepted = !!order.sharing_term_accepted_at
  if (!delivered && !approved) return true
  if (escolhaPendenteDe(order)) return true
  if (delivered && order.slug && !termAccepted) return true
  return false
}

// Prioridade de exibição dos pedidos pagos: ação pendente no topo.
function paidPriority(order: Order): number {
  if (order.status === "DELIVERED") return 2          // entregue (mais embaixo)
  if (!order.lyricsApproved) return 0                  // precisa aprovar letra (topo)
  return 1                                             // em produção
}

function journeyStepState(order: Order, index: number): StepState {
  const delivered = order.status === "DELIVERED"
  const approved  = !!order.lyricsApproved
  const escolha   = escolhaPendenteDe(order)
  // done por marco
  const done = [
    true,                                       // 0 pagamento (o stepper só aparece em pedido pago)
    approved,                                   // 1 letra
    escolha || delivered,                       // 2 produção (as versões já saíram do Suno)
    delivered,                                  // 3 versão (escolhida — ou entrega legada de 1 faixa)
    delivered,                                  // 4 entrega
  ]
  if (done[index]) return "done"
  if (index === currentStepIndex(order)) return "current"
  return "todo"
}

function MinhaMusicaContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const orderId      = searchParams.get("orderId")

  const [user, setUser]     = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({})
  const [termChecked, setTermChecked] = useState<Record<string, boolean>>({})
  const [acceptingTerm, setAcceptingTerm] = useState<string | null>(null)
  const [gaveUpProd, setGaveUpProd] = useState(false)
  // Pedido entregue (sem ação pendente) vira linha compacta por padrão —
  // senão a tela cresce sem fim conforme o cliente acumula pedidos.
  // Modal de detalhes — substitui o antigo colapsar/expandir inline: pedido
  // sem ação pendente vira capinha no carrossel, detalhes abrem aqui.
  const [openDetailOrderId, setOpenDetailOrderId] = useState<string | null>(null)

  async function acceptDeliveryTerm(orderId: string) {
    setAcceptingTerm(orderId)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/orders/${orderId}/aceitar-entrega`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    })
    setAcceptingTerm(null)
    if (res.ok) await loadOrders()
  }

  const [linkPrompt, setLinkPrompt] = useState<{ code: string; maskedEmail: string } | null>(null)
  const [linking, setLinking]       = useState(false)
  const [claimOpen, setClaimOpen]   = useState(false)
  const [claimEmail, setClaimEmail] = useState("")
  const [claimMsg, setClaimMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [claiming, setClaiming]     = useState(false)
  const claimed = searchParams.get("reivindicado")

  // "Minhas Músicas" e "Rede Fiz Música" guardam a lista de playlists cada
  // uma na sua própria memória (design já existente) — esse contador avisa
  // a raia de "Minhas Playlists" pra recarregar sempre que uma das duas
  // criar/alterar uma playlist, sem precisar compartilhar estado de verdade.
  const [playlistsVersion, setPlaylistsVersion] = useState(0)

  // Busca da aba Músicas. As contagens vêm das próprias prateleiras (a Rede
  // busca o catálogo por conta) — usar os setters direto como callback mantém
  // a referência estável e evita laço de render.
  const [busca, setBusca] = useState("")
  const [nMinhas, setNMinhas] = useState(0)
  const [nRede, setNRede] = useState(0)

  // Aba no endereço (?aba=musicas): sem isso, atualizar a página ou usar o
  // botão Voltar jogava o cliente de volta em Pedidos sem explicação.
  const abaUrl = searchParams.get("aba")
  const aba: Aba = abaUrl === "musicas" || abaUrl === "carreira" ? abaUrl : "pedidos"
  function irPara(a: Aba) {
    const qs = new URLSearchParams(Array.from(searchParams.entries()))
    if (a === "pedidos") qs.delete("aba"); else qs.set("aba", a)
    router.replace(qs.toString() ? `/minha-musica?${qs}` : "/minha-musica", { scroll: false })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function loadOrders() {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/orders`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      cache: "no-store",
    })
    const d = await res.json()
    const orders: Order[] = d.orders ?? []

    // Busca revisões pendentes
    const revisions = await Promise.all(
      orders.map((o) =>
        fetch(`/api/orders/${o.id}/contestar`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        }).then((r) => r.json()).catch(() => ({ revision: null }))
      )
    )
    const ordersWithRevisions = orders.map((o, i) => ({ ...o, revision: revisions[i]?.revision ?? null }))

    setOrders(ordersWithRevisions)
    setLoading(false)
  }

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault()
    setClaiming(true)
    setClaimMsg(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch("/api/conta/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ purchaseEmail: claimEmail }),
    })
    const d = await res.json()
    setClaiming(false)
    if (res.ok) {
      setClaimMsg({ ok: true, text: `Enviamos um e-mail de confirmação para ${d.sentTo}. Clique no link de lá para vincular o pedido.` })
      setClaimEmail("")
    } else {
      setClaimMsg({ ok: false, text: d.error ?? "Erro ao reivindicar." })
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(data.session.user)
      else router.push("/entrar")
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) setUser(session.user)
      else router.push("/entrar")
    })
    return () => listener.subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    if (!user) return
    loadOrders().catch(() => setLoading(false))
    // Pedido recém-comprado com e-mail diferente do login? Oferece vincular.
    if (orderId) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        const r = await fetch(`/api/conta/link-order?orderId=${orderId}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          cache: "no-store",
        }).then((res) => res.json()).catch(() => null)
        if (r?.status === "linkable") setLinkPrompt({ code: r.code, maskedEmail: r.maskedEmail })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])


  async function confirmLink() {
    setLinking(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch("/api/conta/link-order", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ orderId }),
    })
    setLinking(false)
    setLinkPrompt(null)
    if (res.ok) await loadOrders()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/")
  }

  // Auto-refresh enquanto algum pedido está em produção: re-checa a cada 8s e a
  // tela troca sozinha (o stepper avança / abre "escolher versão") quando fica
  // pronta. Pausa com a aba oculta; desiste após ~3 min (rede de segurança).
  const anyInProduction = orders.some((o) => {
    const paid = o.paymentStatus === "PAID"
    const escolhaPendente = paid && o.musicStatus === "RELEASED" && !o.slug && (o.tracks?.length ?? 0) > 0
    return paid && !!o.lyricsApproved && o.status !== "DELIVERED" && !escolhaPendente
  })

  useEffect(() => {
    if (!anyInProduction || !user) return
    setGaveUpProd(false)
    const started = Date.now()
    const id = setInterval(() => {
      if (document.hidden) return
      if (Date.now() - started > 3 * 60 * 1000) { setGaveUpProd(true); clearInterval(id); return }
      loadOrders()
    }, 8000)
    return () => clearInterval(id)
    // eslint-disable-next-line
  }, [anyInProduction, user])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07060d" }}>
        <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const firstName = (user.user_metadata?.full_name as string)?.split(" ")[0] || user.email?.split("@")[0]

  // Sem abas: topo = só quem precisa de ação agora (empilhado, sem "escolher
  // um principal"); carrossel = todo o resto (em produção ou entregue).
  // Abandonado não vira card grande (perderia o "escolher um principal" pra
  // sempre), mas também não some da tela — entra discreto no carrossel.
  const heroOrders = orders
    .filter((o) => precisaAcao(o))
    .sort((a, b) => paidPriority(a) - paidPriority(b) || dbTime(b.createdAt) - dbTime(a.createdAt))
  const shelfOrders = orders
    .filter((o) => (o.paymentStatus === "PAID" && !precisaAcao(o)) || (o.paymentStatus !== "PAID" && o.status === "ABANDONED"))
    .sort((a, b) => paidPriority(a) - paidPriority(b) || dbTime(b.createdAt) - dbTime(a.createdAt))

  // "Minhas músicas" não é dado novo — é derivado dos mesmos pedidos entregues
  // que já alimentam o carrossel, só que reempacotado como prateleira.
  const libraryTracks: LibraryTrack[] = shelfOrders
    .filter((o) => o.status === "DELIVERED" && o.slug)
    .map((o) => {
      const principal = o.tracks?.find((t) => t.audioUrl === o.mp3Url) ?? o.tracks?.[0]
      return {
        id: o.id,
        title: principal?.title ?? o.subcategory,
        occasion: o.subcategory,
        slug: o.slug as string,
        imageUrl: principal?.imageUrl ?? null,
        audioUrl: principal?.audioUrl ?? null,
        lyrics: o.lyrics ?? null,
        lyricsLrc: o.lyricsLrc ?? null,
      }
    })

  // Conteúdo completo de um pedido — usado tanto no card grande (hero, quando
  // precisa de ação) quanto dentro do modal (aberto a partir do carrossel).
  // Nunca duplicado: as duas chamadas vêm daqui.
  function renderOrderDetail(order: Order) {
    const paid       = order.paymentStatus === "PAID"
    const delivered  = order.status === "DELIVERED"
    const approved   = !!order.lyricsApproved
    // Escolha pendente: versões liberadas e o cliente ainda não escolheu (sem slug).
    const escolhaPendente = paid && order.musicStatus === "RELEASED" && !order.slug && (order.tracks?.length ?? 0) > 0
    const inProdPhase = paid && approved && !delivered && !escolhaPendente
    const hasRevision      = !!order.revision
    const revisionPending  = order.revision?.status === "PENDING"
    const termAccepted     = !!order.sharing_term_accepted_at
    const musicaPronta     = delivered && !!order.slug && termAccepted && (order.tracks?.length ?? 0) > 1

    return (
      <>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="font-bold text-lg">{order.subcategory}</p>
              {order.is_revision && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300 font-semibold">REVISÃO</span>
              )}
              {order.products?.name && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-pink-500/40 bg-pink-500/15 text-pink-200 font-semibold">
                  {order.products.name}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">#{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
          {order.payments?.amount != null && (
            <p className="text-pink-400 font-bold whitespace-nowrap text-sm">
              R$ {Number(order.payments.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>

        {/* JORNADA — stepper de 5 passos (ações do cliente + espera). Continua
            visível mesmo entregue (tudo verde) — abaixo dela, VersoesEntregues
            mostra a navegação "o que fazer agora", que é outra coisa. */}
        {paid && (
          <div className="flex items-start mb-5">
            {JOURNEY.map((s, i) => {
              const st = journeyStepState(order, i)
              return (
                <div key={s.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center w-12">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] transition-all ${
                      st === "done"    ? "bg-green-400 text-black font-bold" :
                      st === "current" ? "bg-fuchsia-500 ring-4 ring-fuchsia-500/25 animate-pulse" :
                                         "bg-white/10 text-white/30"
                    }`}>
                      {st === "done" ? "✓" : <span className="text-xs">{s.icon}</span>}
                    </span>
                    <span className={`text-[10px] mt-1.5 text-center leading-tight ${
                      st === "done"    ? "text-green-400" :
                      st === "current" ? "text-fuchsia-300 font-semibold" :
                                         "text-gray-600"
                    }`}>{s.label}</span>
                  </div>
                  {i < JOURNEY.length - 1 && (
                    <span className={`h-0.5 flex-1 mx-1 mb-4 ${
                      journeyStepState(order, i) === "done" ? "bg-green-400/50" : "bg-white/10"
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!paid && (
          <p className="text-yellow-400 text-sm mb-4">⏳ Aguardando confirmação do pagamento</p>
        )}

        {/* FLUXO GUIADO: Letra → Fotos → Aprovar & gerar */}
        {paid && !delivered && !approved && (
          <PreparoFlow
            orderId={order.id}
            photoToken={order.photo_token}
            isRevision={order.is_revision}
            temFotos={(order.features ?? TUDO).fotos > 0}
            onApproved={loadOrders}
          />
        )}

        {/* ESCOLHER VERSÃO — versões liberadas, cliente ainda não escolheu */}
        {escolhaPendente && (
          <EscolherVersao orderId={order.id} tracks={order.tracks!} onChosen={loadOrders} />
        )}

        {/* EM PRODUÇÃO (sem ação): card pulsante. Fotos já foram travadas na aprovação. */}
        {inProdPhase && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-3 bg-fuchsia-500/10 border border-fuchsia-500/20">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-fuchsia-500" />
            </span>
            <div>
              <p className="text-fuchsia-300 font-semibold text-sm">Sua música está sendo criada</p>
              <p className="text-fuchsia-400/70 text-xs leading-relaxed">
                Pode fechar a página — avisamos por e-mail assim que ficar pronta.
                <strong className="text-fuchsia-200"> Você não precisa fazer nada.</strong>
              </p>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <span className="text-fuchsia-300/70 text-[11px]">
                  {gaveUpProd
                    ? "Está demorando um pouco mais que o normal — avisamos por e-mail. 💜"
                    : "⏳ Esta tela atualiza sozinha quando ficar pronta."}
                </span>
                <button
                  onClick={() => { setGaveUpProd(false); loadOrders() }}
                  className="text-[11px] underline text-fuchsia-300 hover:text-fuchsia-200"
                >
                  Atualizar agora
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Badge de revisão */}
        {hasRevision && revisionPending && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-3 border border-orange-500/25 bg-orange-500/8">
            <span className="text-orange-400 text-lg">✏️</span>
            <div>
              <p className="text-orange-300 font-semibold text-sm">Revisão em análise</p>
              <p className="text-orange-400/60 text-xs">Nossa equipe vai entrar em contato em breve.</p>
            </div>
          </div>
        )}
        {hasRevision && !revisionPending && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-3 border border-fuchsia-500/25 bg-fuchsia-500/8">
            <span className="text-fuchsia-400 text-lg">✅</span>
            <div>
              <p className="text-fuchsia-300 font-semibold text-sm">Revisão aceita</p>
              <p className="text-fuchsia-400/60 text-xs">Sua nova versão está sendo produzida — veja o pedido de revisão na lista.</p>
            </div>
          </div>
        )}

        {/* Portão do Termo de Entrega Digital — antes de liberar o acesso */}
        {delivered && order.slug && !termAccepted && (
          <div className="rounded-xl border border-pink-500/25 bg-pink-500/[0.06] p-4 mb-2">
            <p className="text-sm font-semibold text-white mb-1">🔒 Sua música está pronta!</p>
            <p className="text-xs text-white/50 mb-3">
              Antes de ouvir, baixar e compartilhar, confirme o termo abaixo.
            </p>
            <label className="flex items-start gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={!!termChecked[order.id]}
                onChange={(e) => setTermChecked((p) => ({ ...p, [order.id]: e.target.checked }))}
                className="w-4 h-4 mt-0.5 accent-pink-500 shrink-0"
              />
              <span className="text-xs text-white/60 leading-relaxed">
                Li e aceito o{" "}
                <a href="/legal/entrega-digital" className="text-pink-400 underline">Termo de Entrega Digital</a>
                {" "}e entendo que o <strong className="text-white/80">compartilhamento da música é de minha responsabilidade</strong>.
              </span>
            </label>
            <button
              onClick={() => acceptDeliveryTerm(order.id)}
              disabled={!termChecked[order.id] || acceptingTerm === order.id}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
            >
              {acceptingTerm === order.id ? "Liberando…" : "Aceitar e liberar minha música →"}
            </button>
          </div>
        )}

        {/* Música pronta com as 2 versões do Suno — ambas disponíveis */}
        {musicaPronta && (
          <VersoesEntregues
            orderId={order.id}
            tracks={order.tracks!}
            principalUrl={order.mp3Url ?? null}
            slug={order.slug ?? null}
            photoToken={order.photo_token}
            photoCount={order.photoCount}
            features={order.features ?? TUDO}
            canRevise={!hasRevision && !order.is_revision}
            onQr={() => setQrUrl(`https://fizmusica.com.br/m/${order.slug}`)}
            onNaoGostei={() => router.push(`/contestar/${order.id}`)}
            onChanged={loadOrders}
          />
        )}

        {/* Ações — entrega legada (1 música, sem versões do Suno) */}
        <div className="flex flex-wrap gap-2">
          {delivered && order.slug && termAccepted && (order.tracks?.length ?? 0) <= 1 && (
            <>
              <a
                href={`/m/${order.slug}`}
                className="flex-1 min-w-[140px] text-center py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 6px 24px rgba(240,25,107,0.35)" }}
              >
                ▶ Ouvir minha música
              </a>
              {order.mp3Url && (order.features ?? TUDO).download && (
                <a
                  href={`/api/orders/${order.id}/musica/download`}
                  download
                  className="flex-1 min-w-[140px] text-center py-3 rounded-xl text-sm font-semibold border border-white/15 text-white/80 hover:bg-white/5 transition-colors"
                >
                  ⬇ Baixar MP3
                </a>
              )}
              {!hasRevision && (order.features ?? TUDO).qrcode && (
                <button
                  onClick={() => setQrUrl(`https://fizmusica.com.br/m/${order.slug}`)}
                  className="flex-1 min-w-[140px] text-center py-3 rounded-xl text-sm font-semibold border border-[#B8963E]/40 text-[#B8963E] hover:bg-[#B8963E]/10 transition-colors"
                >
                  📱 Imprimir QR e fazer a surpresa
                </button>
              )}
            </>
          )}
          {delivered && termAccepted && !hasRevision && !order.is_revision && (order.features ?? TUDO).revisao && (order.tracks?.length ?? 0) <= 1 && (
            <button
              onClick={() => router.push(`/contestar/${order.id}`)}
              className="w-full mt-1 py-2.5 rounded-xl text-xs font-medium border border-white/10 text-white/40 hover:border-red-500/30 hover:text-red-400 transition-colors"
            >
              Não gostei dessa versão →
            </button>
          )}
        </div>

        {/* Autorização opcional de divulgação — após a música entregue */}
        {delivered && order.slug && termAccepted && (
          <PublicacaoConsent orderId={order.id} initial={!!order.publication_consent} />
        )}

        {/* Detalhes do pedido — resumo do que foi preenchido */}
        <div className="mt-4 pt-3 border-t border-white/5">
          {openDetails[order.id] && <DetalhesPedido order={order} />}
          <button
            onClick={() => setOpenDetails((p) => ({ ...p, [order.id]: !p[order.id] }))}
            className="w-full text-center text-white/40 hover:text-white/70 text-xs py-1.5 transition-colors"
          >
            {openDetails[order.id] ? "Ocultar detalhes ▲" : "Ver detalhes do pedido ▾"}
          </button>
        </div>
      </>
    )
  }

  return (
    <PlayerProvider>
    <ToastProvider>
    <div className="relative min-h-screen text-white font-sans overflow-hidden" style={{ background: "#07060d" }}>
      {/* Fundo gradiente da marca */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0" style={{ background: "radial-gradient(55% 45% at 12% 6%, rgba(240,25,107,0.26) 0%, transparent 60%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(55% 50% at 90% 96%, rgba(168,85,247,0.24) 0%, transparent 62%)" }} />
      </div>

      {/* Popup: vincular pedido recém-comprado com e-mail diferente */}
      {qrUrl && <QRModal url={qrUrl} onClose={() => setQrUrl(null)} />}

      {linkPrompt && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-5">
          <div className="bg-[#15131d] border border-white/10 rounded-3xl p-7 max-w-sm w-full text-center">
            <div className="text-4xl mb-3">🔗</div>
            <h2 className="text-xl font-bold mb-2">Vincular seu pedido?</h2>
            <p className="text-gray-300 text-sm leading-relaxed mb-5">
              Você entrou com <strong>{user.email}</strong>, mas o pedido <strong className="text-pink-300">#{linkPrompt.code}</strong> foi feito com <strong>{linkPrompt.maskedEmail}</strong>.
              Quer vincular este pedido a esta conta e usar <strong>{user.email}</strong> daqui pra frente?
            </p>
            <div className="space-y-2">
              <button
                onClick={confirmLink}
                disabled={linking}
                className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-50 py-3 rounded-2xl font-semibold transition-colors"
              >
                {linking ? "Vinculando…" : "Sim, vincular à minha conta"}
              </button>
              <button onClick={() => setLinkPrompt(null)} className="w-full text-gray-400 hover:text-white text-sm py-2">
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10">
        <Header showButton={false} />

        {/* Mais largo no desktop: as raias agora quebram em linha em vez de
            rolar na horizontal, então largura extra vira mais capa visível. */}
        {/* pb extra no celular: a barra de abas fixa cobriria o fim da lista. */}
        <section className="max-w-3xl lg:max-w-5xl mx-auto px-5 pt-24 pb-40 sm:pb-16">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">
                Olá, <span className="bg-gradient-to-r from-pink-400 to-fuchsia-500 bg-clip-text text-transparent">{firstName}</span>
              </h1>
              <p className="text-gray-400 mt-1 text-sm">{user.email}</p>
            </div>
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-red-400 transition-colors">Sair</button>
          </div>

          <TabsDesktop aba={aba} onAba={irPara} onCriar={() => router.push("/criar")} />

          {claimed === "ok" && (
            <div className="mb-4 bg-green-500/10 border border-green-500/20 text-green-300 rounded-2xl px-4 py-3 text-sm">
              ✅ Pedido vinculado à sua conta com sucesso!
            </div>
          )}
          {claimed === "erro" && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl px-4 py-3 text-sm">
              ❌ Link de vinculação inválido ou expirado.
            </div>
          )}

          {/* ── ABA PEDIDOS ────────────────────────────────────────────── */}
          {aba === "pedidos" && <>
          {orders.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white/[0.03] border border-white/10 rounded-2xl mb-6">
              <p className="text-4xl mb-3">🎵</p>
              <p>Nenhum pedido encontrado para este e-mail.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6" style={{ borderLeft: "3px solid rgba(255,255,255,0.25)" }}>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center text-base shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}>📦</div>
                <h3 className="text-sm font-semibold flex-1 min-w-0 truncate">Meus pedidos</h3>
                <InfoTooltip text="Acompanhe o status de cada pedido e edite conforme a sua necessidade." />
              </div>
              <p className="text-xs text-white/50 mb-3">Gerencie suas músicas e edições</p>

              {heroOrders.length > 0 ? (
                <p className="text-[10.5px] uppercase tracking-wide font-bold text-fuchsia-300 mb-2.5 flex items-center gap-1.5">🔥 Precisa de você</p>
              ) : shelfOrders.length > 0 ? (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-green-500/8 border border-green-500/20 mb-1">
                  <span className="text-lg">✅</span>
                  <p className="text-xs font-semibold text-green-300">Tudo em dia — nada pendente no momento.</p>
                </div>
              ) : null}

              {heroOrders.length > 0 && (
                <div className="space-y-4 mb-2">
                  {heroOrders.map((order) => {
                    if (order.paymentStatus !== "PAID") {
                      const hasProduct = !!order.productId && !!order.products?.price
                      const href = hasProduct
                        ? `/checkout?orderId=${order.id}&productId=${order.productId}&productName=${encodeURIComponent(order.products!.name)}&price=${order.products!.price}`
                        : `/produtos?orderId=${order.id}`
                      return (
                        <div key={order.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-white/85 truncate">{order.subcategory}</p>
                            <p className="text-[11px] text-white/40">
                              {order.products?.name ?? order.context} · #{order.id.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                          <a
                            href={href}
                            className="shrink-0 text-center text-xs font-semibold px-4 py-2.5 rounded-xl text-white transition-all hover:brightness-110"
                            style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
                          >
                            {hasProduct ? "Finalizar pagamento →" : "Escolher produto →"}
                          </a>
                        </div>
                      )
                    }
                    return (
                      <div key={order.id} className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
                        <div className="p-6">{renderOrderDetail(order)}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {(() => {
                // Duas raias separadas — entregue/em produção em cima,
                // pendente (abandonado) embaixo. Antes vinham misturados
                // numa fileira só, difícil de escanear com o olho.
                const producedShelf = shelfOrders.filter((o) => o.paymentStatus === "PAID")
                const pendingShelf  = shelfOrders.filter((o) => o.paymentStatus !== "PAID")

                function tile(order: Order) {
                  const delivered = order.status === "DELIVERED"
                  const abandonado = order.paymentStatus !== "PAID"
                  const principal = order.tracks?.find((t) => t.audioUrl === order.mp3Url) ?? order.tracks?.[0]
                  return (
                    <button
                      key={order.id}
                      onClick={() => setOpenDetailOrderId(order.id)}
                      className={`shrink-0 w-28 text-left group ${abandonado ? "opacity-60 hover:opacity-90" : ""}`}
                    >
                      <div
                        className="relative w-28 h-28 rounded-xl border border-white/10 flex items-center justify-center text-2xl bg-cover bg-center"
                        style={{ background: principal?.imageUrl ? `url(${principal.imageUrl}) center/cover` : abandonado ? "linear-gradient(135deg,#3a3a3a,#1f1f1f)" : "linear-gradient(135deg,#3a1440,#7a1f5c)" }}
                      >
                        {!principal?.imageUrl && (abandonado ? "💳" : "🎁")}
                        <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          abandonado ? "bg-white/15 text-white/70" : delivered ? "bg-green-500/90 text-green-950" : "bg-fuchsia-500/90 text-fuchsia-950"
                        }`}>
                          {abandonado ? "💳 Pendente" : delivered ? "✓ Entregue" : "🎵 Em produção"}
                        </span>
                      </div>
                      <p className="text-xs font-medium mt-1.5 truncate group-hover:text-fuchsia-300 transition-colors">{order.subcategory}</p>
                      <p className="text-[11px] text-white/40 truncate">{order.products?.name}</p>
                    </button>
                  )
                }

                return (
                  <>
                    {producedShelf.length > 0 && (
                      <>
                        <div className="flex items-center gap-2.5 mt-4 mb-3">
                          <span className="text-[10.5px] uppercase tracking-wide font-bold text-white/40 whitespace-nowrap">Entregues</span>
                          <span className="h-px flex-1 bg-white/10" />
                        </div>
                        <div className="flex gap-3 overflow-x-auto sm:flex-wrap sm:overflow-x-visible pb-2 -mx-1 px-1">
                          {producedShelf.map(tile)}
                        </div>
                      </>
                    )}

                    {pendingShelf.length > 0 && (
                      <>
                        <div className="flex items-center gap-2.5 mt-4 mb-3">
                          <span className="text-[10.5px] uppercase tracking-wide font-bold text-white/40 whitespace-nowrap">Pendentes</span>
                          <span className="h-px flex-1 bg-white/10" />
                        </div>
                        <div className="flex gap-3 overflow-x-auto sm:flex-wrap sm:overflow-x-visible pb-2 -mx-1 px-1">
                          {pendingShelf.map(tile)}
                        </div>
                      </>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Modal de detalhes — aberto a partir de uma capinha do carrossel */}
          {openDetailOrderId && (() => {
            const order = orders.find((o) => o.id === openDetailOrderId)
            if (!order) return null
            return (
              <div
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setOpenDetailOrderId(null)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#15111f] p-6"
                >
                  <button
                    onClick={() => setOpenDetailOrderId(null)}
                    className="float-right text-white/40 hover:text-white text-lg leading-none -mt-1"
                    aria-label="Fechar"
                  >
                    ✕
                  </button>
                  {order.paymentStatus !== "PAID" ? (
                    <div>
                      <p className="font-bold text-lg mb-1">{order.subcategory}</p>
                      <p className="text-xs text-gray-400 mb-4">
                        {order.products?.name ?? order.context} · #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-sm text-white/60 mb-4">
                        Esse pedido não foi finalizado. Se ainda quiser essa música, é só retomar o pagamento.
                      </p>
                      <a
                        href={
                          order.productId && order.products?.price
                            ? `/checkout?orderId=${order.id}&productId=${order.productId}&productName=${encodeURIComponent(order.products.name)}&price=${order.products.price}`
                            : `/produtos?orderId=${order.id}`
                        }
                        className="block text-center py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                        style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
                      >
                        {order.productId && order.products?.price ? "Finalizar pagamento →" : "Escolher produto →"}
                      </a>
                    </div>
                  ) : (
                    renderOrderDetail(order)
                  )}
                </div>
              </div>
            )
          })()}

          {/* Datas e indicação também vivem aqui, mas em versão de uma linha —
              o card completo fica na Carreira, pra onde estes atalhos levam. */}
          <FaixaAtalhos onIr={() => irPara("carreira")} />
          </>}

          {/* ── ABA MÚSICAS ────────────────────────────────────────────── */}
          {aba === "musicas" && <>
          <BuscaMusicas valor={busca} onValor={setBusca} resultados={busca.trim() ? nMinhas + nRede : null} />

          {/* Minhas músicas & playlists — auto-populado dos pedidos entregues.
              As raias de playlist (uma por playlist, com as músicas já
              dentro) ficam embutidas aqui, logo abaixo de "Minha Playlist". */}
          <MinhasMusicas tracks={libraryTracks} playlistsVersion={playlistsVersion} busca={busca} onContagem={setNMinhas} onPlaylistsChanged={() => setPlaylistsVersion((v) => v + 1)} />

          {/* Ouvir na Rede Fiz Música — catálogo de outros clientes autorizados */}
          <RedeFizMusica busca={busca} onContagem={setNRede} onPlaylistsChanged={() => setPlaylistsVersion((v) => v + 1)} />

          <FaixaAtalhos onIr={() => irPara("carreira")} />
          </>}

          {/* ── ABA CARREIRA ───────────────────────────────────────────── */}
          {/* Nasce com indicação, datas e conta. Nível e discos entram aqui
              quando o programa de fidelidade existir. */}
          {aba === "carreira" && <>
          <CarreiraPainel nome={firstName ?? ""} email={user.email ?? ""} />

          <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
            {/* Indicar amigos — link único (modelo B), funil compartilhou/acessou/comprou */}
            <ReferirAmigos />

            {/* Datas especiais — ligada à conta, não ao pedido */}
            <DatasEspeciais />
          </div>

          {/* Ajuda — regras desta tela */}
          <AjudaCliente />

          {/* Reivindicar pedido feito com outro e-mail */}
          <div className="mt-8 border-t border-white/10 pt-6">
            {!claimOpen ? (
              <button onClick={() => setClaimOpen(true)} className="text-sm text-gray-400 hover:text-white transition-colors">
                Fez um pedido com outro e-mail? <span className="text-pink-400">Vincular aqui →</span>
              </button>
            ) : (
              <form onSubmit={submitClaim} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3">
                <p className="text-sm font-medium">Vincular pedidos feitos com outro e-mail</p>
                <p className="text-xs text-gray-500">Enviaremos um e-mail de confirmação para o e-mail usado na compra. Ao confirmar, todos os pedidos daquele e-mail entram na sua conta.</p>
                <input
                  type="email" value={claimEmail} onChange={(e) => setClaimEmail(e.target.value)}
                  placeholder="E-mail usado na compra"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500"
                />
                {claimMsg && (
                  <p className={`text-xs px-3 py-2 rounded-lg ${claimMsg.ok ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
                    {claimMsg.text}
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="submit" disabled={claiming}
                    className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                    {claiming ? "Enviando…" : "Enviar confirmação"}
                  </button>
                  <button type="button" onClick={() => { setClaimOpen(false); setClaimMsg(null) }}
                    className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10">
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
          </>}
        </section>

        <Footer />
      </div>
    </div>
    <MiniPlayer />
    <TabBarMobile aba={aba} onAba={irPara} onCriar={() => router.push("/criar")} />
    </ToastProvider>
    </PlayerProvider>
  )
}

export default function MinhaMusica() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07060d" }}>
        <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MinhaMusicaContent />
    </Suspense>
  )
}
