"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import Header from "@/app/components/Header"

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const brickRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<{ unmount: () => void } | null>(null)

  const orderId      = searchParams.get("orderId")      ?? ""
  const productId    = searchParams.get("productId")    ?? ""
  const productName  = searchParams.get("productName")  ?? ""
  const price        = Number(searchParams.get("price") ?? "0")
  const deliveryId   = searchParams.get("deliveryId")   ?? undefined

  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "pix" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const [pixData, setPixData] = useState<{ qrCodeBase64: string; qrCode: string; ticketUrl: string | null } | null>(null)
  const [pixCopied, setPixCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startPixPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const d = await fetch(`/api/orders/${orderId}`).then((r) => r.json())
        if (d?.order?.paymentStatus === "PAID") {
          if (pollRef.current) clearInterval(pollRef.current)
          router.replace(`/sucesso?orderId=${orderId}&status=approved`)
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
        const d = await fetch(`/api/orders/${orderId}`).then((r) => r.json())
        if (d?.order?.paymentStatus === "PAID") {
          router.replace(`/sucesso?orderId=${orderId}&status=approved`)
          return
        }
      } catch {
        // se a checagem falhar, segue o fluxo (a guarda do servidor ainda protege)
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
      },
      customization: {
        paymentMethods: {
          creditCard: "all",
          debitCard: "all",
          bankTransfer: "all",  // Pix
          ticket: "all",        // Boleto
          atm: "all",
          mercadoPago: ["wallet_purchase"],
          maxInstallments: 12,
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
            <button
              onClick={() => router.back()}
              className="hidden lg:inline-block transition-all px-5 py-2.5 rounded-2xl text-sm font-medium text-white/60 hover:text-white mb-5"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              ← Voltar
            </button>
            <h1 className="text-2xl font-bold mb-1">Finalizar pagamento</h1>
            <div className="flex items-center justify-between">
              <p className="text-white/55 text-sm">{productName}</p>
              <p className="text-pink-400 font-bold text-lg">
                R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
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
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl p-4 text-sm">
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
                R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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

          {/* Container do Brick */}
          <div
            id="payment-brick-container"
            ref={brickRef}
            className={status === "processing" || status === "pix" ? "opacity-0 pointer-events-none h-0 overflow-hidden" : ""}
          />

          {/* Segurança */}
          {status !== "pix" && (
            <p className="text-center text-xs text-white/30 mt-6">
              🔒 Pagamento 100% seguro via Mercado Pago
            </p>
          )}
        </div>
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
