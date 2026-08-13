"use client"

import { useEffect, useRef, useState } from "react"
import { track } from "@/lib/track"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"
import JourneyProgress from "@/app/components/JourneyProgress"

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const brickRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<{ unmount: () => void } | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const orderId      = searchParams.get("orderId")      ?? ""
  const productId    = searchParams.get("productId")    ?? ""
  const productName  = searchParams.get("productName")  ?? ""
  const price        = Number(searchParams.get("price") ?? "0")
  const deliveryId   = searchParams.get("deliveryId")   ?? undefined

  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "pix" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const [pixData, setPixData] = useState<{ qrCodeBase64: string; qrCode: string; ticketUrl: string | null } | null>(null)
  const [pixCopied, setPixCopied] = useState(false)
  const [freeSubmitting, setFreeSubmitting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const payerEmailRef = useRef<string>("")

  // Confirmação do e-mail de acesso (evita typo no e-mail do wizard)
  const [orderEmail, setOrderEmail] = useState("")
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailInput, setEmailInput] = useState("")
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailMsg, setEmailMsg] = useState("")

  async function saveEmail() {
    const v = emailInput.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setEmailMsg("E-mail inválido."); return }
    setSavingEmail(true); setEmailMsg("")
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setEmailMsg(d.error ?? "Não consegui salvar."); setSavingEmail(false); return }
      setOrderEmail(v)
      payerEmailRef.current = v
      setEditingEmail(false)
    } catch {
      setEmailMsg("Falha de conexão.")
    }
    setSavingEmail(false)
  }

  // Cupom
  const [couponInput, setCouponInput] = useState((searchParams.get("cupom") ?? "").toUpperCase())
  const [coupon, setCoupon] = useState<{ code: string; discount: number; finalTotal: number } | null>(null)
  const [couponMsg, setCouponMsg] = useState("")
  const [checkingCoupon, setCheckingCoupon] = useState(false)
  const couponRef = useRef<string>("")

  async function applyCoupon() {
    if (!couponInput.trim()) return
    setCheckingCoupon(true); setCouponMsg("")
    const d = await fetch("/api/coupons/validate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponInput.trim(), total: price }),
    }).then((r) => r.json()).catch(() => ({ valid: false, reason: "Erro de conexão." }))
    setCheckingCoupon(false)
    if (d.valid) {
      setCoupon({ code: d.code, discount: d.discount, finalTotal: d.finalTotal })
      couponRef.current = d.code
      setCouponMsg("")
    } else {
      setCoupon(null); couponRef.current = ""
      setCouponMsg(d.reason ?? "Cupom inválido.")
    }
  }

  function removeCoupon() {
    setCoupon(null); couponRef.current = ""; setCouponInput(""); setCouponMsg("")
  }

  const displayTotal = coupon ? coupon.finalTotal : price
  // Cupom que zera o total (ex.: 100% de teste) → não dá pra cobrar no MP; usa o
  // caminho "pedido grátis". Exige que um cupom esteja de fato aplicado.
  const isFreeOrder = !!coupon && displayTotal <= 0

  async function submitFree() {
    setFreeSubmitting(true)
    try {
      const res = await fetch("/api/payments/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          productId,
          deliveryOptionId: deliveryId,
          couponCode: couponRef.current || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.success || data.alreadyPaid) {
        router.replace(`/sucesso?orderId=${orderId}&status=approved`)
        return
      }
      setErrorMsg(data.error ?? "Não foi possível concluir o pedido grátis.")
      setStatus("error")
    } catch {
      setErrorMsg("Falha de conexão. Tente novamente.")
      setStatus("error")
    } finally {
      setFreeSubmitting(false)
    }
  }

  function startPixPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const d = await fetch(`/api/payments/status?orderId=${orderId}`, { cache: "no-store" }).then((r) => r.json())
        if (d?.paid) {
          if (pollRef.current) clearInterval(pollRef.current)
          const mp = d.mpPaymentId ? `&mpPaymentId=${d.mpPaymentId}` : ""
          router.replace(`/sucesso?orderId=${orderId}&status=approved${mp}`)
        }
      } catch {}
    }, 4000)
  }

  async function copyPix() {
    if (!pixData?.qrCode) return
    await navigator.clipboard.writeText(pixData.qrCode)
    setPixCopied(true)
    setTimeout(() => setPixCopied(false), 2000)
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // O erro renderiza acima do Brick — sem isso, se o cliente já estava rolado
  // pra baixo preenchendo o cartão, a mensagem passa despercebida.
  // Chegou na tela de pagamento — penúltimo degrau do funil.
  useEffect(() => { track("checkout") }, [])

  useEffect(() => {
    if (status === "error") errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [status])

  // Auto-aplica cupom vindo na URL (link do e-mail de repescagem)
  useEffect(() => {
    if (couponInput.trim() && price > 0 && !coupon) applyCoupon()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price])

  useEffect(() => {
    if (!orderId || !price) {
      router.push("/")
      return
    }

    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY

    if (!publicKey) {
      setErrorMsg("Chave pública do Mercado Pago não configurada.")
      setStatus("error")
      return
    }

    let cancelled = false

    // Anti-duplo-pagamento: se o pedido já está pago, vai direto pro sucesso
    ;(async () => {
      try {
        const d = await fetch(`/api/orders/${orderId}`, { cache: "no-store" }).then((r) => r.json())
        if (d?.order?.email) { payerEmailRef.current = d.order.email; setOrderEmail(d.order.email); setEmailInput(d.order.email) }
        if (d?.order?.paymentStatus === "PAID") {
          router.replace(`/sucesso?orderId=${orderId}&status=approved`)
          return
        }
      } catch {
        // se a checagem falhar, segue o fluxo (a guarda do servidor ainda protege)
      }
      if (cancelled) return

      // Se já existe um PIX pendente para este pedido, retoma o MESMO QR (não gera outro)
      try {
        const s = await fetch(`/api/payments/status?orderId=${orderId}`, { cache: "no-store" }).then((r) => r.json())
        if (s?.paid) {
          const mp = s.mpPaymentId ? `&mpPaymentId=${s.mpPaymentId}` : ""
          router.replace(`/sucesso?orderId=${orderId}&status=approved${mp}`)
          return
        }
        if (s?.pix?.qrCodeBase64) {
          setPixData(s.pix)
          setStatus("pix")
          startPixPolling()
          return
        }
      } catch {
        // segue para o formulário normal
      }
      if (cancelled) return

      // Carrega o SDK do MP no browser
      const script = document.createElement("script")
      script.src = "https://sdk.mercadopago.com/js/v2"
      script.async = true
      script.onload = () => initBrick(publicKey)
      script.onerror = () => {
        setErrorMsg("Falha ao carregar SDK de pagamento.")
        setStatus("error")
      }
      document.head.appendChild(script)
    })()

    return () => {
      cancelled = true
      controllerRef.current?.unmount()
    }
  }, [orderId, price])

  async function initBrick(publicKey: string) {
    const mp = new (window as any).MercadoPago(publicKey, { locale: "pt-BR" })
    const bricks = mp.bricks()

    const settings = {
      initialization: {
        amount: price,
        // Pré-preenche o pagador (e-mail do pedido) para o Brick NÃO pedir o e-mail no PIX
        ...(payerEmailRef.current ? { payer: { email: payerEmailRef.current } } : {}),
      },
      customization: {
        paymentMethods: {
          creditCard: "all",
          bankTransfer: "all",  // Pix
          ticket: "all",        // Boleto
          mercadoPago: ["wallet_purchase"],
          maxInstallments: 5,
        },
        visual: {
          style: {
            theme: "dark",
            customVariables: {
              baseColor: "#f0196b",
              baseColorFirstVariant: "#d946ef",
              baseColorSecondVariant: "#f0196b",
              borderRadiusSmall: "8px",
              borderRadiusMedium: "12px",
              borderRadiusLarge: "16px",
            },
          },
        },
      },
      callbacks: {
        onReady: () => setStatus("ready"),
        onError: (error: any) => {
          console.error("[Brick error]", JSON.stringify(error))
          const msg = error?.message || error?.cause || JSON.stringify(error) || "Erro desconhecido"
          setErrorMsg(`Erro ao carregar pagamento: ${msg}`)
          setStatus("error")
        },
        onSubmit: async ({ selectedPaymentMethod, formData }: any) => {
          setStatus("processing")
          try {
            const res = await fetch("/api/payments/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                productId,
                productName,
                price,
                deliveryOptionId: deliveryId,
                paymentMethod: selectedPaymentMethod,
                formData,
                couponCode: couponRef.current || undefined,
              }),
            })

            const data = await res.json()

            // Pedido já estava pago (corrida): manda pro sucesso em vez de erro
            if (data.alreadyPaid) {
              router.replace(`/sucesso?orderId=${orderId}&status=approved`)
              return
            }

            if (!res.ok || !data.success) {
              setErrorMsg(data.error ?? "Erro ao processar pagamento.")
              setStatus("error")
              return { error: data.error }
            }

            // PIX: mostra o QR na própria tela e aguarda a confirmação (webhook)
            if (data.pix?.qrCodeBase64) {
              setPixData(data.pix)
              setStatus("pix")
              startPixPolling()
              return
            }

            // Cartão aprovado: vai para a tela de sucesso
            router.push(`/sucesso?orderId=${orderId}&status=${data.status}&mpPaymentId=${data.paymentId}`)
          } catch {
            setErrorMsg("Falha de conexão. Tente novamente.")
            setStatus("error")
          }
        },
      },
    }

    controllerRef.current = await bricks.create("payment", "payment-brick-container", settings)
  }

  return (
    <div className="text-white font-sans" style={{ background: "#07060d" }}>
      <div className="hidden lg:block">
        <Header showButton={false} />
      </div>

      {/* Gradiente de fundo */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[55vw] h-[55vw] rounded-full blur-[120px] opacity-25"
             style={{ background: "radial-gradient(circle, #f0196b 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[45vw] h-[45vw] rounded-full blur-[120px] opacity-15"
             style={{ background: "radial-gradient(circle, #d946ef 0%, transparent 70%)" }} />
      </div>

      {/* Jornada completa */}
      <div className="relative z-10 border-b border-white/[0.06] px-4">
        <JourneyProgress current={3} />
      </div>

      {/* Barra superior mobile */}
      <div className="lg:hidden relative z-10 px-5 pt-4 pb-2">
        <button
          onClick={() => router.back()}
          className="text-white/50 text-sm hover:text-white transition-colors"
        >
          ← Voltar
        </button>
      </div>

      <div className="relative z-10 min-h-screen lg:pt-24">
        <div className="max-w-2xl mx-auto px-5 py-4 lg:py-12">

          {/* Cabeçalho */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1">Finalizar pagamento</h1>
            <div className="flex items-center justify-between">
              <p className="text-white/55 text-sm">{productName}</p>
              <div className="text-right">
                {coupon && (
                  <p className="text-white/30 text-xs line-through">
                    R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                )}
                <p className="text-pink-400 font-bold text-lg">
                  R$ {displayTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Cupom de desconto */}
            <div className="mt-4">
              {coupon ? (
                <div className="flex items-center justify-between gap-2 rounded-xl px-4 py-3 border border-green-500/25 bg-green-500/8">
                  <div>
                    <p className="text-green-300 text-sm font-semibold">🎟️ {coupon.code} aplicado</p>
                    <p className="text-green-400/70 text-xs">Você economizou R$ {coupon.discount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <button onClick={removeCoupon} className="text-xs text-white/40 hover:text-white/70 transition-colors">Remover</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon() } }}
                    placeholder="Tem um cupom?"
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500 uppercase placeholder:normal-case"
                  />
                  <button
                    onClick={applyCoupon}
                    disabled={checkingCoupon || !couponInput.trim()}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium border border-pink-500/30 text-pink-300 hover:bg-pink-500/10 disabled:opacity-40 transition-colors"
                  >
                    {checkingCoupon ? "…" : "Aplicar"}
                  </button>
                </div>
              )}
              {couponMsg && <p className="text-red-400 text-xs mt-1.5">{couponMsg}</p>}
            </div>
          </div>

          {/* Indicador de carregamento */}
          {status === "loading" && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Processando */}
          {status === "processing" && (
            <div className="flex flex-col items-center py-16 gap-4">
              <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-white/60 text-sm">Processando pagamento…</p>
            </div>
          )}

          {/* Erro */}
          {status === "error" && (
            <div ref={errorRef} className="mb-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl p-4 text-sm">
              ❌ {errorMsg}
              <button onClick={() => setStatus("ready")} className="block mt-2 text-pink-400 underline text-xs">
                Tentar novamente
              </button>
            </div>
          )}

          {/* PIX — QR na tela + copia e cola */}
          {status === "pix" && pixData && (
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 rounded-full px-4 py-1.5 text-xs font-medium mb-5">
                ⏳ Aguardando pagamento via PIX
              </div>

              <div className="bg-white p-4 rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="QR Code PIX"
                  width={220}
                  height={220}
                  className="block"
                />
              </div>

              <p className="text-white/70 text-sm mt-5 max-w-sm">
                Abra o app do seu banco, escolha <strong>PIX → Pagar com QR Code</strong> e aponte para o código acima.
              </p>
              <p className="text-pink-400 font-bold text-lg mt-2">
                R$ {displayTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>

              <button
                onClick={copyPix}
                className="mt-5 w-full max-w-sm bg-white/10 border border-white/15 hover:bg-white/15 transition-all py-3 rounded-2xl text-sm font-medium"
              >
                {pixCopied ? "✅ Código copiado!" : "📋 Copiar código PIX (copia e cola)"}
              </button>

              <p className="break-all text-[11px] text-white/30 mt-3 max-w-sm font-mono">{pixData.qrCode}</p>

              <div className="flex items-center gap-2 mt-6 text-white/50 text-sm">
                <span className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                Assim que o pagamento for confirmado, seguimos automaticamente.
              </div>
            </div>
          )}

          {/* Confirmação do e-mail de acesso — reduz typo no e-mail do wizard */}
          {(status === "ready" || status === "loading") && orderEmail && (
            <div className="mb-4 rounded-2xl border border-pink-500/25 bg-pink-500/[0.06] px-4 py-3">
              {!editingEmail ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-white/45 uppercase tracking-wider">Enviaremos o acesso da sua música para</p>
                    <p className="text-sm text-white font-medium truncate">📧 {orderEmail}</p>
                  </div>
                  <button onClick={() => { setEditingEmail(true); setEmailMsg("") }}
                    className="shrink-0 text-xs font-medium text-pink-300 hover:text-pink-200 underline underline-offset-2">
                    Não é esse? Editar
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-[11px] text-white/45 uppercase tracking-wider mb-1.5">Corrigir e-mail de acesso</p>
                  <div className="flex gap-2">
                    <input
                      type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEmail() } }}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500"
                    />
                    <button onClick={saveEmail} disabled={savingEmail}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:brightness-110"
                      style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
                      {savingEmail ? "…" : "Salvar"}
                    </button>
                  </div>
                  {emailMsg && <p className="text-red-400 text-xs mt-1.5">{emailMsg}</p>}
                </div>
              )}
            </div>
          )}

          {/* Container do Brick — escondido no pedido grátis (não há o que cobrar) */}
          <div
            id="payment-brick-container"
            ref={brickRef}
            className={status === "processing" || status === "pix" || isFreeOrder ? "opacity-0 pointer-events-none h-0 overflow-hidden" : ""}
          />

          {/* Pedido grátis — cupom zerou o total (ex.: 100% de teste) */}
          {isFreeOrder && status !== "processing" && status !== "pix" && (
            <div className="mt-2">
              <div className="mb-4 rounded-2xl border border-green-500/25 bg-green-500/[0.08] px-4 py-3 text-sm text-green-200">
                🎁 Este cupom cobre 100% do valor — seu pedido sai <strong>sem custo</strong>. É só concluir.
              </div>
              <button
                onClick={submitFree}
                disabled={freeSubmitting}
                className="w-full py-4 rounded-2xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}
              >
                {freeSubmitting ? "Concluindo…" : "Concluir pedido grátis 🎁"}
              </button>
            </div>
          )}

          {/* Segurança */}
          {status !== "pix" && !isFreeOrder && (
            <>
              <p className="text-center text-xs text-white/30 mt-6">
                🔒 Pagamento 100% seguro via Mercado Pago
              </p>
              <p className="text-center text-[11px] text-white/30 mt-2 leading-relaxed">
                Ao pagar, você concorda com os{" "}
                <a href="/legal/termos-de-uso" className="underline hover:text-white/60">Termos de Uso</a>,{" "}
                <a href="/legal/politica-de-privacidade" className="underline hover:text-white/60">Política de Privacidade</a> e{" "}
                <a href="/legal/reembolso-e-cancelamento" className="underline hover:text-white/60">Política de Reembolso</a>.
              </p>
            </>
          )}

          {/* Voltar — desktop, no rodapé (mesmo padrão da tela /produtos) */}
          <div className="hidden lg:flex justify-between items-center mt-10">
            <button
              onClick={() => router.back()}
              className="transition-all px-7 py-3.5 rounded-2xl text-sm font-medium text-white/60 hover:text-white"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              ← Voltar
            </button>
          </div>
        </div>
      </div>

      {/* Footer — desktop only (mesmo padrão das outras telas) */}
      <div className="hidden lg:block relative z-10">
        <Footer />
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07060d" }}>
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
