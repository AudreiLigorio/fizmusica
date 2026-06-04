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

  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")

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

    return () => {
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
          ticket: "all",       // boleto
          bankTransfer: "all", // Pix
          mercadoPago: "all",  // carteira MP
        },
        visual: {
          style: {
            theme: "dark",
            customVariables: {
              baseColor: "#f0196b",
              baseColorFirstVariant: "#d946ef",
              baseColorSecondVariant: "#f0196b",
              errorColor: "#f0196b",
              successColor: "#22c55e",
              warningColor: "#f59e0b",
              fontSizeSmall: "12px",
              fontSizeMedium: "14px",
              fontSizeLarge: "16px",
              borderRadiusSmall: "8px",
              borderRadiusMedium: "12px",
              borderRadiusLarge: "16px",
              borderRadiusFull: "999px",
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

            if (!res.ok || !data.success) {
              setErrorMsg(data.error ?? "Erro ao processar pagamento.")
              setStatus("error")
              return { error: data.error }
            }

            // Redireciona para tela de sucesso
            router.push(`/sucesso?orderId=${orderId}&status=${data.status}`)
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

      <div className="relative z-10 min-h-screen lg:pt-24">
        <div className="max-w-2xl mx-auto px-5 py-8 lg:py-12">

          {/* Cabeçalho */}
          <div className="mb-6">
            <button onClick={() => router.back()} className="text-white/50 text-sm mb-4 block">← Voltar</button>
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

          {/* Container do Brick */}
          <div
            id="payment-brick-container"
            ref={brickRef}
            className={status === "processing" ? "opacity-0 pointer-events-none h-0 overflow-hidden" : ""}
          />

          {/* Segurança */}
          <p className="text-center text-xs text-white/30 mt-6">
            🔒 Pagamento 100% seguro via Mercado Pago
          </p>
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
