"use client"

import React, { useEffect, useRef, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"
import JourneyProgress from "@/app/components/JourneyProgress"
import AvisoCompraApp from "@/app/components/AvisoCompraApp"
import { useBloquearCompraNoApp } from "@/lib/canal"
import { supabase } from "@/lib/supabase"
import ShippingForm, { EMPTY_SHIPPING, isShippingValid, type ShippingData } from "./ShippingForm"
import { useScrollTopOnStepChange } from "@/app/hooks/useScrollTopOnStepChange"
import { avisar, confirmar } from "@/app/components/Dialogo"

type DeliveryOption = {
  id: string
  label: string
  days: number
  price_extra: number
  sort_order: number
}

type ProductImage = { id: string; url: string; is_cover: boolean; sort_order: number }

type Product = {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  featured: boolean
  category?: string | null
  photo_limit?: number | null
  feat_lyrics_sync?: boolean | null
  feat_qrcode?: boolean | null
  feat_revision?: boolean | null
  // Migração 071: quantos créditos este plano custa (null = só dinheiro).
  credit_price?: number | null
  // Migração 071: quantos créditos a COMPRA concede (> 0 = é pacote, não música).
  credits_granted?: number | null
  product_delivery_options: DeliveryOption[]
  product_images: ProductImage[]
}

// Fotos de exemplo já usadas na galeria pública do produto — mostradas no
// "detalhes" dos planos que incluem fotos, pra ilustrar o recurso.
const EXAMPLE_PHOTOS = [
  "https://esjjcqwxcflppyqrixqt.supabase.co/storage/v1/object/public/product-images/prod-digital/photo_2_1782620463333.jpg",
  "https://esjjcqwxcflppyqrixqt.supabase.co/storage/v1/object/public/product-images/prod-digital/photo_3_1782621244638.jpg",
]

// "Pra você" (uso pessoal) vs "Pra presentear" (retrospectiva com fotos) —
// o recurso de fotos é o que separa as duas jornadas.
function planGroup(p: Product): "voce" | "presentear" {
  return (p.photo_limit ?? 0) > 0 ? "presentear" : "voce"
}

function planChips(p: Product): string[] {
  const chips: string[] = []
  if (p.feat_lyrics_sync) chips.push("letra sincronizada")
  if ((p.photo_limit ?? 0) > 0) chips.push(`${p.photo_limit} fotos`)
  if (p.feat_qrcode) chips.push("QR Code")
  if (p.feat_revision) chips.push("ajustes inclusos")
  if (p.category === "DIGITAL_PHYSICAL") chips.push("caixa física", "frete grátis")
  return chips
}

const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  "Música Digital": (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </svg>
  ),
  "Box Premium": (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
  ),
  "QR Code Musical": (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      <rect x="5" y="5" width="3" height="3" fill="white"/><rect x="16" y="5" width="3" height="3" fill="white"/><rect x="5" y="16" width="3" height="3" fill="white"/>
      <path d="M14 14h3v3h-3z"/><path d="M17 17h4"/><path d="M17 21v-4"/>
    </svg>
  ),
  "Spotify Frame": (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 13.5a4 4 0 0 1 8 0"/><path d="M6 16.5a7 7 0 0 1 12 0"/><circle cx="12" cy="11" r="1" fill="white"/>
    </svg>
  ),
}

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
}

function ProdutosContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get("orderId")

  const [products, setProducts]     = useState<Product[]>([])
  const [loading, setLoading]       = useState(true)
  const [step, setStep]             = useState<1 | 2>(1)
  const [selected, setSelected]     = useState<Product | null>(null)
  const [delivery, setDelivery]     = useState<DeliveryOption | null>(null)
  const [shipping, setShipping]     = useState<ShippingData>(EMPTY_SHIPPING)
  const [savingShipping, setSavingShipping] = useState(false)
  const [promoCoupon, setPromoCoupon] = useState<{ code: string; label: string; description: string | null } | null>(null)

  // Cupom digitado pelo cliente (visto nas redes). Validado contra o total atual;
  // o checkout revalida de forma autoritativa, então o desconto aqui é só preview.
  const [couponInput, setCouponInput]       = useState("")
  // Campo de cupom recolhido por padrão: aberto no topo, ele manda quem não tem
  // cupom sair da página pra procurar um (padrão conhecido de perda de venda).
  // Com banner de campanha na tela, abre sozinho — ali o código está à vista.
  const [appliedCoupon, setAppliedCoupon]   = useState<{ code: string; discount: number; finalTotal: number } | null>(null)
  const [couponMsg, setCouponMsg]           = useState("")
  const [checkingCoupon, setCheckingCoupon] = useState(false)

  // "detalhes" expandido e foto ampliada por card — vários podem estar abertos.
  // SALDO DE CRÉDITOS nesta tela, e não só no checkout.
  //
  // Antes a pessoa com 5 créditos atravessava a escolha do plano sem nenhuma
  // menção a eles e só descobria no fim, abaixo do botão "Pagar". Crédito é
  // dinheiro JÁ PAGO: mandar alguém até a tela de cobrança para gastar o que
  // já gastou é pedir que atravesse uma catraca paga.
  //
  // O crachá aparece só no card que aceita — e isso responde sozinho "onde
  // meu crédito vale?", sem nenhuma linha explicando onde não vale.
  const [saldoCreditos, setSaldoCreditos] = useState(0)
  const [usandoCredito, setUsandoCredito] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const r = await fetch("/api/creditos", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then((x) => x.json()).catch(() => null)
      if (vivo) setSaldoCreditos(Number(r?.saldo ?? 0))
    })()
    return () => { vivo = false }
  }, [])

  function custoEmCreditos(p: Product): number | null {
    const c = p.credit_price
    return typeof c === "number" && c > 0 ? c : null
  }
  function podeUsarCredito(p: Product): boolean {
    const c = custoEmCreditos(p)
    return c !== null && saldoCreditos >= c && !!orderId
  }

  // Gasta o crédito e PULA o checkout: não há nada a cobrar.
  //
  // O rótulo do botão é a confirmação. Um "Selecionar" genérico que
  // silenciosamente gastasse um crédito seria pior que um diálogo a mais.
  // Toque repetido não gasta dois: o índice único (order_id, 'consumo')
  // barra a segunda tentativa do mesmo pedido.
  async function usarCredito(p: Product) {
    if (!orderId) return
    setUsandoCredito(p.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push("/entrar"); return }
      const res = await fetch("/api/creditos/usar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId, productId: p.id }),
      })
      const d = await res.json().catch(() => ({}))
      if (d.success || d.jaPago) { router.push(`/sucesso?orderId=${orderId}&status=approved`); return }
      alert(d.error ?? "Não foi possível usar seus créditos.")
    } catch {
      alert("Falha de conexão. Tente novamente.")
    } finally {
      setUsandoCredito(null)
    }
  }

  // ── PACOTE: oferta paralela, fora da lista de planos ───────────────────
  //
  // O pacote NÃO entra na lista (ver o filtro de `produtosVisiveis`): ali ele
  // seria comparado com os planos e escolhido no lugar de um, o que quebrava
  // o pedido. Aqui embaixo ele é outra coisa — "em vez de pagar esta, leve
  // dez" — e o botão vai pelo caminho próprio, que cria um pedido separado
  // para o pacote e deixa o pedido da música intacto.
  const pacote = products.find((p) => (p.credits_granted ?? 0) > 0) ?? null
  // Contra qual preço o desconto é calculado. Achada por `credit_price` e não
  // por nome: é a definição de "a música que o crédito paga".
  const avulsaCredito = products.find((p) => !(p.credits_granted ?? 0) && (p.credit_price ?? 0) > 0) ?? null
  const [comprandoPacote, setComprandoPacote] = useState(false)

  async function comprarPacote() {
    if (!pacote) return
    setComprandoPacote(true)
    try {
      // SEM parede de login. O crédito precisa de dono, mas a conta nasce
      // depois do pagamento, pelo e-mail que a pessoa já deu no wizard (ver
      // `donoDoSaldo` em lib/credits.ts). Pedir login aqui interrompia a
      // compra no pior momento: antes de ela ter qualquer motivo pra criar
      // conta.
      //
      // Quem JÁ está logado manda o token assim mesmo — aí o pedido nasce
      // com dono e o saldo cai na conta certa, mesmo que o e-mail do wizard
      // seja outro.
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/creditos/comprar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ productId: pacote.id, pedidoPendente: orderId ?? undefined }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.orderId) { alert(d.error ?? "Não foi possível iniciar a compra."); return }
      const qs = new URLSearchParams({
        orderId: d.orderId, productId: d.productId, productName: d.productName, price: String(d.price),
      })
      // Para onde voltar depois de pagar. O servidor é quem garante o débito
      // do crédito; isto aqui só decide a TELA, pra pessoa cair na música
      // dela e não numa tela de pacote que some com o pedido.
      if (d.pedidoVinculado) qs.set("voltarPara", String(d.pedidoVinculado))
      router.push(`/checkout?${qs}`)
    } catch {
      alert("Falha de conexão. Tente novamente.")
    } finally {
      setComprandoPacote(false)
    }
  }

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [zoomSrc, setZoomSrc] = useState<Record<string, string | null>>({})

  function toggleDetails(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const contentRef = useRef<HTMLDivElement>(null)
  useScrollTopOnStepChange(step, contentRef)

  const isPhysical = selected?.category === "DIGITAL_PHYSICAL"

  // Plano que a pessoa já escolheu na vitrine da home, repassado pelo wizard.
  // Aqui ele só PRÉ-SELECIONA: a tela continua sendo a de escolha, com o
  // comparativo à vista e o cupom disponível, porque entre clicar na home e
  // chegar aqui passaram vários minutos e várias telas — e é aqui que quem
  // pegou o plano de entrada costuma subir de plano.
  const planoDaHome = searchParams.get("produto")
  /** O pacote foi a escolha feita na home? Então ele aparece marcado. */
  const pacoteVeioDaHome = !!planoDaHome && products.some(
    (p) => p.id === planoDaHome && (p.credits_granted ?? 0) > 0,
  )

  // De qual grupo veio a escolha da home. Quem clicou na Retrospectiva lá já
  // decidiu "é presente"; chegar aqui e encontrar o Essencial de R$ 9,90 como
  // PRIMEIRA coisa da tela, com o plano dela em último lugar, é a tela
  // convidando ao erro depois de a pessoa ter contado a história inteira.
  const grupoDeOrigem = planoDaHome
    ? (products.find((p) => p.id === planoDaHome) ? planGroup(products.find((p) => p.id === planoDaHome)!) : null)
    : null

  // O grupo de origem vem primeiro; o outro recolhe. Recolher e não ESCONDER
  // é deliberado: quem clicou na Retrospectiva pode não saber que custa
  // R$ 69,90, e tirar o plano de R$ 9,90 da tela faria parte dessas pessoas
  // abandonar em vez de comprar o mais barato — perde venda e parece
  // armadilha. Um toque continua resolvendo.
  const ordemDosGrupos: ("voce" | "presentear")[] =
    grupoDeOrigem === "presentear" ? ["presentear", "voce"] : ["voce", "presentear"]
  const [outrosAbertos, setOutrosAbertos] = useState(false)

  useEffect(() => {
    fetch("/api/produtos")
      .then((r) => r.json())
      .then((d) => {
        const lista: Product[] = d.products ?? []
        setProducts(lista)
        // Se o plano veio da home, abre com ele marcado. Ignora em silêncio
        // quando não bate com nada: um plano desativado no admin depois do
        // clique não pode travar a tela — a pessoa escolhe outro normalmente.
        const escolhido = planoDaHome ? lista.find((x) => x.id === planoDaHome) : null
        // PACOTE é exceção: quem clicou nele na home também cai aqui, mas o
        // pacote NÃO é o plano da música — é saldo. Marcá-lo como `selected`
        // mandaria o "Ir para pagamento" tentar cobrar o pedido da música como
        // se fosse pacote, que é exatamente o que o servidor recusa.
        //
        // Ele ainda serve pra definir o GRUPO de origem ("Pra você"), que é o
        // que abre a tela no lugar certo — e o bloco do pacote está ali, com o
        // botão próprio.
        if (escolhido && (escolhido.credits_granted ?? 0) <= 0) handleSelectProduct(escolhido)
        setLoading(false)
      })
      .catch(() => setLoading(false))
    fetch("/api/coupons/active")
      .then((r) => r.json())
      .then((d) => { if (d.coupon) setPromoCoupon(d.coupon) })
      .catch(() => {})
  }, [])

  // O PACOTE não entra aqui. Esta tela é o funil de UMA música: quem chega
  // nela veio do wizard, com ocasião e história já descritas. O pacote tem
  // `photo_limit` 0 e caía no grupo "Para você", ao lado da avulsa, por
  // R$ 49,90 — lido como plano melhor por quem só comparava preço. Escolher
  // ele aqui trocava o plano da música pelo pacote e matava o pedido (ver
  // `recusaDePacoteEmPedidoDeMusica` em lib/credits.ts).
  //
  // Ele continua à venda, na porta certa: o bloco próprio da vitrine da home,
  // que cria um pedido sem briefing por /api/creditos/comprar.
  const produtosVisiveis = products.filter((p) => (p.credits_granted ?? 0) <= 0)

  // O botão "Salvando…" é transitório: só vale durante o PATCH em andamento.
  // Ao voltar do checkout pelo botão do navegador, o Chrome restaura a página do
  // bfcache com o estado JS congelado (savingShipping=true). O evento `pageshow`
  // dispara nessa restauração; `focus` cobre a reativação da aba. Limpamos em ambos.
  useEffect(() => {
    const clearSaving = () => setSavingShipping(false)
    window.addEventListener("pageshow", clearSaving)
    window.addEventListener("focus", clearSaving)
    return () => {
      window.removeEventListener("pageshow", clearSaving)
      window.removeEventListener("focus", clearSaving)
    }
  }, [])

  async function applyCoupon(codeArg?: string) {
    const code = (codeArg ?? couponInput).trim()
    if (!code) return
    // Sem produto: total=0 → o endpoint só confere existência/ativo (pending).
    const total = selected ? selected.price + (delivery?.price_extra ?? 0) : 0
    setCheckingCoupon(true); setCouponMsg("")
    const d = await fetch("/api/coupons/validate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, total }),
    }).then((r) => r.json()).catch(() => ({ valid: false, reason: "Erro de conexão." }))
    setCheckingCoupon(false)
    if (d.valid) {
      setAppliedCoupon({ code: d.code, discount: d.discount ?? 0, finalTotal: d.finalTotal ?? 0 })
      setCouponInput(d.code); setCouponMsg("")
    } else {
      setAppliedCoupon(null); setCouponMsg(d.reason ?? "Cupom inválido.")
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null); setCouponInput(""); setCouponMsg("")
  }

  // Se o cliente trocar o produto/prazo após aplicar, revalida o cupom contra o novo total.
  useEffect(() => {
    if (appliedCoupon) applyCoupon(appliedCoupon.code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery, selected])

  async function handleSelectProduct(product: Product) {
    // Trocar para um plano SEM fotos, vindo de um COM fotos, é a troca que
    // machuca: a pessoa veio pela retrospectiva, contou a história inteira e
    // sai com um produto que não tem foto nenhuma — e só descobre depois de
    // pagar. Perguntar aqui pega inclusive quem troca de propósito sem
    // entender a diferença, que é o caso mais comum.
    //
    // Só nesse sentido. Subir de plano não tira nada de ninguém.
    //
    // `confirmar()` do projeto, nunca o confirm do navegador (regra da casa).
    const perdeFotos = (selected?.photo_limit ?? 0) > 0 && (product.photo_limit ?? 0) === 0
    if (perdeFotos) {
      const trocar = await confirmar({
        titulo: "Trocar de plano?",
        mensagem:
          `A ${selected!.name} inclui ${selected!.photo_limit} fotos sincronizadas com a música. ` +
          `O ${product.name} não tem fotos — só a música, a capa e a letra acompanhando.`,
        botao: `Trocar para ${product.name}`,
        cancelar: `Manter a ${selected!.name}`,
      })
      if (!trocar) return
    }

    setSelected(product)
    setDelivery(null)
    setSavingShipping(false)
    // Auto-avança para step 2 se for físico ou houver opções de prazo
    if (product.category === "DIGITAL_PHYSICAL" || product.product_delivery_options.length > 0) {
      setStep(2)
    }
  }

  // Dentro do app da Play Store não vendemos (ver lib/canal.ts).
  const noApp = useBloquearCompraNoApp() === true

  async function handleContinuar() {
    if (!selected) return

    // Sem pedido criado não há pra onde seguir: o checkout inteiro é montado
    // em cima do `orderId`. Antes esta função simplesmente retornava aqui, com
    // o botão "Ir para pagamento" ATIVO na tela — a pessoa clicava e não
    // acontecia nada, sem aviso nenhum, justo no botão de compra. Agora manda
    // pro wizard levando o plano escolhido, que é onde o pedido nasce.
    if (!orderId) {
      router.push(`/criar?produto=${encodeURIComponent(selected.id)}`)
      return
    }

    // Produto físico: salva dados de envio antes de seguir
    if (isPhysical) {
      if (!isShippingValid(shipping)) return
      setSavingShipping(true)
      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(shipping),
        })
        if (!res.ok) {
          await avisar({ titulo: "Não foi possível salvar o endereço", mensagem: "Confira os dados de entrega e tente de novo." })
          return
        }
      } catch {
        await avisar({ titulo: "Sem conexão", mensagem: "Verifique a internet e tente de novo." })
        return
      } finally {
        setSavingShipping(false)
      }
    }

    const params = new URLSearchParams({
      orderId,
      productId:   selected.id,
      productName: delivery ? `${selected.name} — ${delivery.label}` : selected.name,
      price:       String(selected.price + (delivery?.price_extra ?? 0)),
      ...(delivery ? { deliveryId: delivery.id } : {}),
      // Só leva cupom se o cliente realmente aplicou no campo. O banner do cupom
      // público é informativo — não desconta sozinho.
      ...(appliedCoupon ? { cupom: appliedCoupon.code } : {}),
    })

    window.location.href = `/checkout?${params.toString()}`
  }

  const canContinue = isPhysical
    ? isShippingValid(shipping)
    : (step === 2 ? !!delivery : (selected && selected.product_delivery_options.length === 0))

  const finalPrice = selected
    ? selected.price + (delivery?.price_extra ?? 0)
    : 0

  const displayPrice = appliedCoupon ? appliedCoupon.finalTotal : finalPrice

  return (
    <div className="text-white font-sans" style={{ background: "#07060d" }}>

      {/* Gradiente de fundo */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[55vw] h-[55vw] rounded-full blur-[120px] opacity-25"
             style={{ background: "radial-gradient(circle, #f0196b 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[45vw] h-[45vw] rounded-full blur-[120px] opacity-15"
             style={{ background: "radial-gradient(circle, #d946ef 0%, transparent 70%)" }} />
      </div>

      {/* Header — desktop only */}
      <div className="hidden lg:block">
        <Header showButton={false} />
      </div>

      {/* Container adaptativo: mobile fixed / desktop static */}
      <div className="fixed inset-0 z-10 flex flex-col lg:static lg:inset-auto lg:z-auto lg:block lg:min-h-screen lg:pt-24"
           style={{ background: "#07060d" }}>

        {/* Jornada completa */}
        <div className="shrink-0 px-4 border-b border-white/[0.06]">
          <JourneyProgress current={2} />
        </div>

        {/* Mobile: Voltar no topo */}
        <div className="lg:hidden shrink-0 px-5 pt-4 pb-1">
          <button
            onClick={step === 1 ? () => router.push(orderId ? `/criar?orderId=${orderId}&editar=1` : "/criar?editar=1") : () => setStep(1)}
            className="text-white/50 text-sm hover:text-white transition-colors"
          >
            ← Voltar
          </button>
        </div>

        {/* Área de conteúdo */}
        <div ref={contentRef} className="flex-1 overflow-y-auto lg:overflow-visible">
          <div className="px-5 py-4 pb-32 lg:pb-0 lg:max-w-5xl lg:mx-auto lg:px-6 lg:py-12">


            {/* TOPO — só no step 1 */}
            {step === 1 && (
              <div className="mb-6 lg:mb-10">
                <h1 className="text-xl lg:text-2xl font-bold mb-1 leading-tight tracking-tight">
                  Selecione o produto ideal
                </h1>
                {/* "prossiga para o pagamento" fica falso pra quem vai usar crédito —
                    esse caminho não passa por cobrança nenhuma. */}
                <p className="text-gray-400 text-[15px]">Escolha o plano da sua música.</p>
                {saldoCreditos > 0 && (
                  <p className="mt-2 inline-flex items-center gap-2 text-[13px] font-semibold px-3 py-1.5 rounded-full"
                     style={{ color: "#f0abfc", background: "rgba(240,25,107,0.12)", border: "1px solid rgba(240,25,107,0.3)" }}>
                    💿 Você tem {saldoCreditos} {saldoCreditos === 1 ? "crédito" : "créditos"}
                  </p>
                )}

                {/* Banner do cupom ativo */}
                {promoCoupon && (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl px-4 py-3"
                       style={{ background: "linear-gradient(135deg, rgba(240,25,107,0.12), rgba(168,85,247,0.10))", border: "1px dashed rgba(240,25,107,0.4)" }}>
                    <span className="text-2xl">🎟️</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-pink-300">
                        {promoCoupon.label} com o cupom <span className="font-mono bg-pink-500/20 px-1.5 py-0.5 rounded">{promoCoupon.code}</span>
                      </p>
                      <p className="text-sm text-white/50">{promoCoupon.description ?? "Digite o código abaixo e aplique."}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cupom de desconto — topo, abaixo do banner. Vale para os dois produtos.

                Campo SEMPRE ABERTO. Era um link ("🎟️ Tenho um cupom de
                desconto") que abria a caixa no toque, e clientes relataram
                não achar onde usar o cupom (Audrei, 2026-10-26) — o que
                custa caro justamente em quem recebeu um código e vem decidido
                a usar. Um link sublinhado no meio de uma tela de preços não
                se parece com campo.

                Aplicar continua sendo ação do cliente: o campo aberto não
                preenche nem aplica nada sozinho, inclusive quando há banner
                de promoção. */}
            {!loading && (
              <div className="mb-6 lg:mb-10">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between rounded-2xl px-4 py-3"
                       style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
                    <div className="min-w-0">
                      <p className="text-green-300 text-sm font-semibold">
                        🎟️ {appliedCoupon.code} {selected ? "aplicado" : "válido"}
                      </p>
                      <p className="text-green-400/70 text-sm">
                        {selected
                          ? `Você economizou R$ ${fmt(appliedCoupon.discount)}`
                          : "Selecione um produto para aplicar o desconto."}
                      </p>
                    </div>
                    <button onClick={removeCoupon} className="text-sm text-white/50 hover:text-white underline shrink-0 ml-3">
                      Remover
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl px-4 py-3.5"
                       style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <label className="text-sm text-white/70 font-medium">Tem um cupom de desconto?</label>
                    <p className="text-sm text-white/35 mb-2.5">Use o código do banner ou um que você viu nas nossas redes sociais.</p>
                    <div className="flex gap-2">
                      <input
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === "Enter") applyCoupon() }}
                        placeholder="Digite o código"
                        className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-base outline-none focus:border-pink-500 transition-colors uppercase placeholder:normal-case placeholder:text-white/30"
                      />
                      <button
                        onClick={() => applyCoupon()}
                        disabled={checkingCoupon || !couponInput.trim()}
                        className="px-6 py-3 rounded-2xl text-base font-semibold text-white disabled:opacity-40 transition-all shrink-0"
                        style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)" }}
                      >
                        {checkingCoupon ? "…" : "Aplicar"}
                      </button>
                    </div>
                    {couponMsg && <p className="text-red-400 text-sm mt-2">{couponMsg}</p>}
                  </div>
                )}
              </div>
            )}


        {/* ====== STEP 1 — ESCOLHA DO PRODUTO ====== */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : step === 1 ? (
          <div className="space-y-8 mb-4 md:mb-10">
            {ordemDosGrupos.map((group) => {
              const items = produtosVisiveis.filter((p) => planGroup(p) === group)
              if (items.length === 0) return null
              // Sem origem (entrou direto no wizard), nada recolhe: não há
              // decisão anterior a respeitar, e os dois grupos são iguais.
              const ehOutro = !!grupoDeOrigem && group !== grupoDeOrigem
              if (ehOutro && !outrosAbertos) {
                return (
                  <button
                    key={group}
                    onClick={() => setOutrosAbertos(true)}
                    className="text-sm underline underline-offset-4"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    Ver outros planos
                  </button>
                )
              }
              return (
                <div key={group}>
                  <div className="flex items-center gap-2 mb-3">
                    {group === "voce" ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="rgba(244,114,182,0.7)" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="rgba(244,114,182,0.7)" strokeWidth="2">
                        <rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18"/><path d="M12 8c-1.5 0-3-1-3-2.5A2 2 0 0 1 12 4a2 2 0 0 1 3 1.5C15 7 13.5 8 12 8z"/>
                      </svg>
                    )}
                    <span className="text-[13px] font-semibold tracking-wider uppercase" style={{ color: "rgba(244,114,182,0.7)" }}>
                      {group === "voce" ? "Pra você" : "Pra presentear"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((product) => {
                      const isSelected = selected?.id === product.id
                      const isPhysicalPlan = product.category === "DIGITAL_PHYSICAL"
                      const chips = planChips(product)
                      const isExpanded = expandedIds.has(product.id)
                      const zoomed = zoomSrc[product.id]
                      const withPhotoCount = product.description
                        ? product.description.replace(/\{fotos\}/gi, String(product.photo_limit ?? ""))
                        : null

                      return (
                        <div
                          key={product.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectProduct(product)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectProduct(product) } }}
                          className={`relative text-left rounded-[18px] p-4 border transition-all duration-200 cursor-pointer ${
                            product.featured || isPhysicalPlan ? "mt-3.5" : ""
                          }`}
                          style={{
                            borderColor: isSelected ? "#f0196b" : "rgba(255,255,255,0.14)",
                            background: isSelected ? "rgba(240,25,107,0.12)" : "rgba(255,255,255,0.07)",
                            boxShadow: isSelected ? "0 0 28px rgba(240,25,107,0.18)" : "none",
                          }}
                        >
                          {product.featured && (
                            <div className="absolute -top-2.5 left-3.5 text-[11px] font-bold text-white px-2.5 py-1 rounded-full"
                                 style={{ background: "#f0196b" }}>
                              mais escolhido aqui
                            </div>
                          )}
                          {isPhysicalPlan && (
                            <div className="absolute -top-2.5 left-3.5 text-[11px] font-bold text-white px-2.5 py-1 rounded-full"
                                 style={{ background: "#B8963E" }}>
                              efeito uau garantido
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 mb-1.5">
                            <h3 className="text-[17px] font-semibold leading-tight min-w-0">{product.name}</h3>
                            <span className="text-[17px] font-semibold whitespace-nowrap shrink-0" style={{ color: "#f472b6" }}>
                              R$ {fmt(product.price)}
                              {podeUsarCredito(product) && (
                                <span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                                  {" "}ou {custoEmCreditos(product)} {custoEmCreditos(product) === 1 ? "crédito" : "créditos"}
                                </span>
                              )}
                            </span>
                          </div>

                          <p className="text-sm mb-1" style={{ color: "rgba(74,222,128,0.55)" }}>
                            música personalizada · capa exclusiva · 2ª versão grátis
                          </p>

                          {chips.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2.5">
                              {chips.map((chip) => (
                                <span key={chip} className="text-sm font-medium" style={{ color: "#4ade80" }}>
                                  + {chip}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Ação primária de quem tem crédito: pula a tela de
                              pagamento inteira. "Selecionar e pagar" continua
                              logo abaixo — alguém pode preferir guardar o
                              crédito e pagar esta, e tirar a escolha seria
                              decidir pela pessoa o que fazer com o que ela
                              comprou. */}
                          {podeUsarCredito(product) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); usarCredito(product) }}
                              disabled={usandoCredito !== null}
                              className="w-full mb-3 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-110"
                              style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)" }}
                            >
                              {usandoCredito === product.id
                                ? "Liberando sua música…"
                                : `Usar ${custoEmCreditos(product)} ${custoEmCreditos(product) === 1 ? "crédito" : "créditos"}`}
                            </button>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-sm" style={{ color: isSelected ? "#f472b6" : "rgba(255,255,255,0.6)" }}>
                              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
                                   style={{ borderColor: isSelected ? "#f0196b" : "rgba(255,255,255,0.25)", background: isSelected ? "#f0196b" : "transparent" }}>
                                {isSelected && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              {isSelected ? "Selecionado" : (podeUsarCredito(product) ? "Selecionar e pagar" : "Selecionar")}
                            </div>

                            {withPhotoCount && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleDetails(product.id) }}
                                aria-label="Ver detalhes e fotos"
                                className="flex items-center gap-1 text-[13px]"
                                style={{ color: "rgba(255,255,255,0.5)" }}
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 16v-4M12 8h.01"/>
                                </svg>
                                detalhes
                              </button>
                            )}
                          </div>

                          {isExpanded && withPhotoCount && (
                            <div className="mt-2.5 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }} onClick={(e) => e.stopPropagation()}>
                              <p className="text-sm leading-relaxed mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>
                                {withPhotoCount}{(chips.length > 0) && " Toque numa foto pra ampliar."}
                              </p>
                              {chips.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap">
                                  {isPhysicalPlan && (
                                    <>
                                      <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                                        <svg className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>
                                      </div>
                                      <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                                        <svg className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 2h6M10 2v4l-3 4v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V10l-3-4V2"/></svg>
                                      </div>
                                    </>
                                  )}
                                  {(product.photo_limit ?? 0) > 0 && EXAMPLE_PHOTOS.map((src) => (
                                    <img
                                      key={src}
                                      src={src}
                                      alt="Exemplo de foto do cliente no player"
                                      className="w-11 h-11 rounded-lg object-cover shrink-0 cursor-zoom-in"
                                      onClick={(e) => { e.stopPropagation(); setZoomSrc((prev) => ({ ...prev, [product.id]: prev[product.id] === src ? null : src })) }}
                                    />
                                  ))}
                                  {product.feat_qrcode && !isPhysicalPlan && (
                                    <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                                      <svg className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                                    </div>
                                  )}
                                </div>
                              )}
                              {zoomed && (
                                <img
                                  src={zoomed}
                                  alt="Exemplo de foto do cliente no player, ampliada"
                                  className="w-full rounded-lg mt-2 cursor-zoom-out"
                                  onClick={(e) => { e.stopPropagation(); setZoomSrc((prev) => ({ ...prev, [product.id]: null })) }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* ── Pacote, dentro do "Pra você" ────────────────────
                        Mora aqui porque é isso que ele é: outra forma de
                        resolver a MESMA necessidade do Essencial. Fora do
                        grupo, depois dos presentes, ficava lido como rodapé.

                        O que NÃO pode voltar é ele ser um item selecionável
                        da lista — era assim que o pedido virava pacote e a
                        música morria sem preparo. Por isso ele não tem radio,
                        não passa por `handleSelectProduct` e tem botão
                        próprio: é um card irmão, não uma opção do mesmo
                        seletor. O servidor ainda recusa a troca, de qualquer
                        forma (ver recusaDePacoteEmPedidoDeMusica). */}
                    {group === "voce" && pacote && avulsaCredito && (
                      <div className="rounded-[18px] p-4 border flex flex-col"
                           style={{
                             // Quando o pacote FOI a escolha da home, ele
                             // aparece marcado. Sem isso a pessoa escolhia o
                             // pacote lá, chegava aqui e não via nada
                             // selecionado — parecia que a escolha tinha se
                             // perdido. Ele continua sem radio de propósito:
                             // não é opção do seletor de planos, e virar uma
                             // era o que quebrava o pedido.
                             borderColor: pacoteVeioDaHome ? "#f0196b" : "rgba(255,255,255,0.14)",
                             background: pacoteVeioDaHome ? "rgba(240,25,107,0.12)" : "rgba(255,255,255,0.04)",
                             boxShadow: pacoteVeioDaHome ? "0 0 28px rgba(240,25,107,0.18)" : "none",
                           }}>
                        {pacoteVeioDaHome && (
                          <p className="text-[13px] font-bold mb-1.5" style={{ color: "#f0196b" }}>
                            ✓ Sua escolha
                          </p>
                        )}
                        <p className="text-[15px] font-bold text-white mb-1">Vai fazer mais de uma?</p>
                        <p className="text-sm text-white/55 leading-relaxed">
                          {pacote.credits_granted} músicas por R$ {pacote.price.toFixed(2).replace(".", ",")} — R${" "}
                          {(pacote.price / (pacote.credits_granted ?? 1)).toFixed(2).replace(".", ",")} cada, contra R${" "}
                          {avulsaCredito.price.toFixed(2).replace(".", ",")} na avulsa.
                        </p>

                        {/* A frase que justifica o card estar no funil e não
                            só na home: diz o que acontece com o pedido que a
                            pessoa tem em mãos. Sem ela, comprar o pacote aqui
                            parece abandonar a música. */}
                        {orderId && (
                          <p className="text-sm font-medium mt-2.5" style={{ color: "#f0196b" }}>
                            ✓ Esta música já sai paga com 1 crédito — sobram {(pacote.credits_granted ?? 1) - 1}.
                          </p>
                        )}

                        <button
                          onClick={comprarPacote}
                          disabled={comprandoPacote}
                          className="w-full mt-auto py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-60"
                          style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
                        >
                          {comprandoPacote ? "Abrindo…" : `Levar ${pacote.credits_granted} músicas — R$ ${pacote.price.toFixed(2).replace(".", ",")}`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

          </div>
        ) : null}

        {/* ====== STEP 2 — PRAZO DE ENTREGA ====== */}
        {step === 2 && selected && (
          <div className="mb-10">
            {/* Resumo do produto selecionado */}
            <div className="border border-pink-500 bg-pink-500/10 shadow-[0_0_40px_rgba(236,72,153,0.15)] rounded-[32px] p-6 flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                     style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)", boxShadow: "0 4px 20px rgba(240,25,107,0.3)" }}>
                  {PRODUCT_ICONS[selected.name] ?? "🎶"}
                </div>
                <div>
                  <p className="font-bold text-lg leading-tight">{selected.name}</p>
                  <button onClick={() => setStep(1)} className="text-sm text-pink-400 hover:underline mt-0.5">
                    Trocar produto
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-pink-400 font-bold text-xl">R$ {fmt(selected.price)}</span>
                <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>

            {isPhysical ? (
              <>
                <h2 className="text-2xl font-bold mb-2">📦 Dados para envio</h2>
                <p className="text-gray-200 mb-6">Preencha os dados de quem vai receber o produto.</p>
                <ShippingForm value={shipping} onChange={setShipping} />
              </>
            ) : (<>
            <h2 className="text-2xl font-bold mb-2">⏱ Escolha o prazo de entrega</h2>
            <p className="text-gray-200 mb-6">Quanto mais urgente, mais rápido entregamos.</p>

            <div className="space-y-3">
              {selected.product_delivery_options.map((opt) => {
                const isSelected = delivery?.id === opt.id
                const total = selected.price + opt.price_extra
                return (
                  <button
                    key={opt.id}
                    onClick={() => setDelivery(opt)}
                    className={`w-full text-left rounded-2xl p-5 border transition-all flex items-center justify-between ${
                      isSelected
                        ? "border-pink-500 bg-pink-500/10"
                        : "border-white/10 bg-black/30 hover:border-pink-500/40"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? "border-pink-500 bg-pink-500" : "border-white/20"}`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{opt.label}</p>
                        {opt.price_extra > 0 && (
                          <p className="text-sm text-gray-200 mt-0.5">
                            + R$ {fmt(opt.price_extra)} de urgência
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-pink-400">R$ {fmt(total)}</p>
                      {opt.price_extra === 0 && (
                        <p className="text-sm text-green-400 mt-0.5">Sem acréscimo</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            </>)}
          </div>
        )}

            {/* RODAPÉ — desktop */}
            <div className="hidden lg:flex justify-between items-center mt-10">
              <button
                onClick={step === 1 ? () => router.push(orderId ? `/criar?orderId=${orderId}&editar=1` : "/criar?editar=1") : () => setStep(1)}
                className="transition-all px-7 py-3.5 rounded-2xl text-sm font-medium text-white/60 hover:text-white"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
              >
                ← Voltar
              </button>
              <div className="flex flex-col items-end gap-3">
                {noApp && ((step === 1 && selected && selected.product_delivery_options.length === 0 && !isPhysical) || step === 2) && (
                  <div className="w-80"><AvisoCompraApp compacto /></div>
                )}
                {!noApp && ((step === 1 && selected && selected.product_delivery_options.length === 0 && !isPhysical) || step === 2) && (
                  <button
                    onClick={handleContinuar}
                    disabled={!canContinue || (savingShipping && isPhysical)}
                    className="px-10 py-4 rounded-2xl text-base font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: canContinue ? "linear-gradient(135deg,#f0196b,#d946ef)" : "rgba(255,255,255,0.08)",
                      boxShadow: canContinue ? "0 8px 32px rgba(240,25,107,0.35)" : "none",
                      color: canContinue ? "white" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {(savingShipping && isPhysical) ? "Salvando…" :
                      canContinue ? `Ir para pagamento — R$ ${fmt(displayPrice)} ❤️` :
                      isPhysical ? "Preencha todos os campos" : "Selecione um prazo para continuar"}
                  </button>
                )}
              </div>
            </div>

          </div>{/* fecha px-5 / lg:max-w-5xl */}
        </div>{/* fecha flex-1 overflow-y-auto */}

        {/* RODAPÉ FIXO — mobile (só o botão de continuar; Voltar fica no topo) */}
        {((step === 1 && selected && selected.product_delivery_options.length === 0 && !isPhysical) || step === 2) && (
          <div className="lg:hidden shrink-0 px-5 py-4 border-t border-white/[0.06]"
               style={{ background: "rgba(7,6,13,0.95)", backdropFilter: "blur(16px)" }}>
            {noApp ? (
              <AvisoCompraApp compacto />
            ) : canContinue ? (
              <button
                onClick={handleContinuar}
                disabled={savingShipping && isPhysical}
                className="w-full py-3 rounded-2xl text-base font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)", boxShadow: "0 4px 20px rgba(240,25,107,0.35)" }}
              >
                {(savingShipping && isPhysical) ? "Salvando…" : "Ir para pagamento ❤️"}
              </button>
            ) : (
              <div className="w-full py-3 rounded-2xl text-base font-semibold text-center text-white/40"
                   style={{ background: "rgba(255,255,255,0.05)" }}>
                {isPhysical ? "Preencha os campos" : "Selecione um prazo"}
              </div>
            )}
          </div>
        )}

        {/* Footer — desktop only */}
        <div className="hidden lg:block">
          <Footer />
        </div>

      </div>{/* fecha container adaptativo */}
    </div>
  )
}

export default function ProdutosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ProdutosContent />
    </Suspense>
  )
}

