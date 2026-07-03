"use client"

import { useEffect, useRef, useState } from "react"
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
import { dbTime } from "@/lib/date"

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
  payments?: { amount: number; mpStatus: string | null; paidAt?: string | null } | null
  revision?: { status: string } | null
  is_revision?: boolean
  mp3Url?: string | null
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

// Jornada do cliente pós-pagamento: as 2 primeiras são AÇÕES dele, as 2 últimas são espera.
const JOURNEY = [
  { key: "letra", label: "Aprovar letra", icon: "✍️" },
  { key: "fotos", label: "Fotos",         icon: "📸" },
  { key: "prod",  label: "Produção",      icon: "🎵" },
  { key: "pronta",label: "Pronta",        icon: "✅" },
]

// Índice da etapa ATUAL (foco). Fotos é opcional/paralela: não trava o avanço.
function currentStepIndex(order: Order): number {
  if (order.status === "DELIVERED") return 3                 // Pronta
  if (!order.lyricsApproved) return 0                         // Aprovar letra (bloqueante)
  if ((order.photoCount ?? 0) === 0) return 1                 // Convite p/ fotos
  return 2                                                    // Em produção / espera
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
  const hasPhotos = (order.photoCount ?? 0) > 0
  // done por marco
  const done = [
    approved,                                  // 0 letra
    approved && hasPhotos,                      // 1 fotos (só "done" se realmente adicionou)
    delivered,                                  // 2 produção (done quando entregue)
    delivered,                                  // 3 pronta
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
  const [tab, setTab] = useState<"paid" | "unpaid">("paid")
  const autoTab = useRef(false)
  const [termChecked, setTermChecked] = useState<Record<string, boolean>>({})
  const [acceptingTerm, setAcceptingTerm] = useState<string | null>(null)

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

  // Se não houver pedido pago mas houver não pago, já abre na aba certa (uma vez).
  useEffect(() => {
    if (autoTab.current || loading || orders.length === 0) return
    autoTab.current = true
    const hasPaid = orders.some((o) => o.paymentStatus === "PAID")
    const hasUnpaid = orders.some((o) => o.paymentStatus !== "PAID")
    if (!hasPaid && hasUnpaid) setTab("unpaid")
  }, [loading, orders])

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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07060d" }}>
        <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const firstName = (user.user_metadata?.full_name as string)?.split(" ")[0] || user.email?.split("@")[0]

  // Pedidos pagos (protagonistas) ordenados por urgência; não pagos vão para o rodapé.
  const paidOrders = orders
    .filter((o) => o.paymentStatus === "PAID")
    .sort((a, b) => paidPriority(a) - paidPriority(b) || dbTime(b.createdAt) - dbTime(a.createdAt))
  const unpaidOrders = orders
    .filter((o) => o.paymentStatus !== "PAID")
    .sort((a, b) => dbTime(b.createdAt) - dbTime(a.createdAt))

  return (
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

        <section className="max-w-3xl mx-auto px-5 pt-24 pb-16">
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

          {/* ── PEDIDOS ── */}
          {orders.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white/[0.03] border border-white/10 rounded-2xl mb-6">
              <p className="text-4xl mb-3">🎵</p>
              <p>Nenhum pedido encontrado para este e-mail.</p>
            </div>
          ) : (
            <div className="mb-6">
              {/* Abas: pagos / não pagos */}
              <div className="flex gap-2 mb-5">
                <button onClick={() => setTab("paid")} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === "paid" ? "bg-pink-500/15 border border-pink-500/40 text-pink-200" : "border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/[0.04]"}`}>
                  Pagos
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tab === "paid" ? "bg-pink-500/30 text-pink-100" : "bg-white/10 text-white/50"}`}>{paidOrders.length}</span>
                </button>
                <button onClick={() => setTab("unpaid")} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === "unpaid" ? "bg-yellow-500/15 border border-yellow-500/40 text-yellow-200" : "border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/[0.04]"}`}>
                  Não pagos
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tab === "unpaid" ? "bg-yellow-500/30 text-yellow-100" : "bg-white/10 text-white/50"}`}>{unpaidOrders.length}</span>
                </button>
              </div>

              {/* ABA PAGOS */}
              {tab === "paid" && (
                <div className="space-y-4">
                  {paidOrders.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-white/[0.03] border border-white/10 rounded-2xl">
                      <p className="text-3xl mb-2">🎵</p>
                      <p className="text-sm">Você ainda não tem nenhuma música paga.</p>
                      {unpaidOrders.length > 0 && <p className="text-xs text-gray-500 mt-1">Veja seus pedidos não pagos na outra aba.</p>}
                    </div>
                  ) : paidOrders.map((order) => {
                const paid       = order.paymentStatus === "PAID"
                const delivered  = order.status === "DELIVERED"
                const approved   = !!order.lyricsApproved
                // Escolha pendente: versões liberadas e o cliente ainda não escolheu (sem slug).
                // Tem prioridade — aparece mesmo se algo marcou o pedido como entregue.
                const escolhaPendente = paid && order.musicStatus === "RELEASED" && !order.slug && (order.tracks?.length ?? 0) > 0
                const inProdPhase = paid && approved && !delivered && !escolhaPendente   // na fila / sendo produzida
                const hasRevision      = !!order.revision
                const revisionPending  = order.revision?.status === "PENDING"
                const termAccepted     = !!order.sharing_term_accepted_at
                // Música pronta com as 2 versões: experiência própria de "o que fazer agora".
                const musicaPronta     = delivered && !!order.slug && termAccepted && (order.tracks?.length ?? 0) > 1

                return (
                  <div key={order.id} className={`relative overflow-hidden rounded-2xl border transition-all ${
                    delivered
                      ? "border-green-500/30 bg-green-500/5"
                      : inProdPhase
                        ? "border-fuchsia-500/40 bg-fuchsia-500/5"
                        : "border-white/10 bg-white/[0.04]"
                  }`}>

                    {/* Barra de brilho animada quando em produção */}
                    {inProdPhase && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                        <div className="absolute top-0 left-[-100%] w-2/3 h-full opacity-20"
                             style={{
                               background: "linear-gradient(90deg, transparent, #d946ef, transparent)",
                               animation: "shimmer 2.5s infinite",
                             }} />
                      </div>
                    )}

                    <div className="p-6">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-lg">{order.subcategory}</p>
                            {order.is_revision && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300 font-semibold">REVISÃO</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            {order.products?.name ?? order.context} · #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                        {order.payments?.amount && (
                          <p className="text-pink-400 font-bold whitespace-nowrap text-sm">
                            R$ {Number(order.payments.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>

                      {/* JORNADA — stepper de 4 passos (ações do cliente + espera).
                          Some quando a música já está pronta: lá a própria VersoesEntregues
                          mostra a jornada "o que fazer agora" (Principal → Fotos → Player → Surpresa). */}
                      {paid && !musicaPronta && (
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
                            {order.mp3Url && (
                              <a
                                href={`/api/orders/${order.id}/musica/download`}
                                download
                                className="flex-1 min-w-[140px] text-center py-3 rounded-xl text-sm font-semibold border border-white/15 text-white/80 hover:bg-white/5 transition-colors"
                              >
                                ⬇ Baixar MP3
                              </a>
                            )}
                            {!hasRevision && (
                              <button
                                onClick={() => setQrUrl(`https://fizmusica.com.br/m/${order.slug}`)}
                                className="flex-1 min-w-[140px] text-center py-3 rounded-xl text-sm font-semibold border border-[#B8963E]/40 text-[#B8963E] hover:bg-[#B8963E]/10 transition-colors"
                              >
                                📱 Imprimir QR e fazer a surpresa
                              </button>
                            )}
                          </>
                        )}
                        {/* Entrega legada (1 faixa): o "não gostei" fica aqui. No fluxo de
                            2 versões o botão vive dentro do passo Principal (VersoesEntregues). */}
                        {delivered && termAccepted && !hasRevision && !order.is_revision && (order.tracks?.length ?? 0) <= 1 && (
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
                    </div>
                  </div>
                )
              })}
                </div>
              )}

              {/* ABA NÃO PAGOS */}
              {tab === "unpaid" && (
                <div className="space-y-2">
                  {unpaidOrders.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-white/[0.03] border border-white/10 rounded-2xl">
                      <p className="text-3xl mb-2">✅</p>
                      <p className="text-sm">Nenhum pedido aguardando pagamento.</p>
                    </div>
                  ) : (
                    unpaidOrders.map((order) => {
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
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Criar nova música — em baixo */}
          <button
            onClick={() => router.push("/criar")}
            className="w-full rounded-2xl p-5 mb-4 text-left flex items-center justify-between transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: "rgba(240,25,107,0.08)", border: "1px solid rgba(240,25,107,0.2)" }}
          >
            <div>
              <p className="font-semibold text-base text-pink-300">+ Criar nova música</p>
              <p className="text-white/40 text-xs mt-0.5">Para outra pessoa ou ocasião especial</p>
            </div>
            <span className="text-xl opacity-60">🎵</span>
          </button>

          <style>{`
            @keyframes shimmer { 0% { left: -100% } 100% { left: 200% } }
          `}</style>

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
        </section>

        <Footer />
      </div>
    </div>
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
