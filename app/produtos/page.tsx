"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"

type DeliveryOption = {
  id: string
  label: string
  days: number
  price_extra: number
  sort_order: number
}

type Product = {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  featured: boolean
  product_delivery_options: DeliveryOption[]
}

const PRODUCT_ICONS: Record<string, string> = {
  "Música Digital":   "🎵",
  "Box Premium":      "🎁",
  "QR Code Musical":  "📱",
  "Spotify Frame":    "🖼️",
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
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutError, setCheckoutError] = useState("")

  useEffect(() => {
    fetch("/api/produtos")
      .then((r) => r.json())
      .then((d) => { setProducts(d.products ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function handleSelectProduct(product: Product) {
    setSelected(product)
    setDelivery(null)
    // Auto-avança para step 2 se houver opções de prazo
    if (product.product_delivery_options.length > 0) {
      setStep(2)
    }
  }

  async function handleContinuar() {
    if (!selected || !orderId) return
    setCheckingOut(true)
    setCheckoutError("")

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          productId:        selected.id,
          productName:      selected.name,
          price:            selected.price,
          deliveryOptionId: delivery?.id ?? undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setCheckoutError(data.error ?? "Erro ao iniciar pagamento. Tente novamente.")
        setCheckingOut(false)
        return
      }

      const isProd = process.env.NODE_ENV === "production"
      window.location.href = isProd ? data.checkoutUrl : data.sandboxUrl
    } catch {
      setCheckoutError("Falha de conexão. Verifique sua internet.")
      setCheckingOut(false)
    }
  }

  const finalPrice = selected
    ? selected.price + (delivery?.price_extra ?? 0)
    : 0

  return (
    <div className="min-h-screen bg-black text-white font-sans pt-36">
      <Header showButton={false} />

      <section className="max-w-5xl mx-auto px-6 py-12">

        {/* TOPO */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 px-5 py-2 rounded-full text-pink-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-pink-500 rounded-full shadow-[0_0_8px_rgba(236,72,153,0.9)]" />
            Pedido recebido com sucesso ❤️
          </div>

          <h1 className="text-5xl font-bold mb-5 leading-tight">
            Escolha como receber
            <span className="bg-gradient-to-r from-pink-400 to-fuchsia-500 bg-clip-text text-transparent">
              {" "}sua música
            </span>
          </h1>

          <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Selecione o produto ideal para transformar essa história em uma
            experiência inesquecível.
          </p>
        </div>

        {/* INDICADOR DE STEPS */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {[
            { n: 1, label: "Produto" },
            { n: 2, label: "Prazo de entrega" },
          ].map(({ n, label }, i, arr) => (
            <div key={n} className="flex items-center gap-3">
              <button
                onClick={() => n < step && setStep(n as 1 | 2)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  step === n
                    ? "bg-pink-500/15 border border-pink-500/30 text-pink-300"
                    : step > n
                    ? "bg-white/5 border border-white/10 text-gray-400 hover:text-white cursor-pointer"
                    : "bg-white/5 border border-white/5 text-gray-600 cursor-default"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > n ? "bg-pink-500 text-white" : step === n ? "bg-pink-500 text-white" : "bg-white/10 text-gray-500"
                }`}>
                  {step > n ? "✓" : n}
                </span>
                {label}
              </button>
              {i < arr.length - 1 && <div className="w-8 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        {/* ====== STEP 1 — ESCOLHA DO PRODUTO ====== */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : step === 1 ? (
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {products.map((product) => {
              const isSelected = selected?.id === product.id
              const icon = PRODUCT_ICONS[product.name] ?? "🎶"

              return (
                <button
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className={`relative text-left rounded-[32px] p-8 border transition-all duration-200 ${
                    isSelected
                      ? "border-pink-500 bg-pink-500/10 shadow-[0_0_40px_rgba(236,72,153,0.15)]"
                      : "border-white/10 bg-white/5 hover:border-pink-500/40"
                  }`}
                >
                  {product.featured && (
                    <div className="absolute top-5 right-5 bg-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      MAIS POPULAR
                    </div>
                  )}

                  <div className="w-16 h-16 rounded-2xl bg-pink-500/20 flex items-center justify-center text-3xl mb-6">
                    {icon}
                  </div>

                  <div className="flex items-start justify-between mb-4 gap-4">
                    <h3 className="text-2xl font-bold leading-tight">{product.name}</h3>
                    <span className="text-2xl font-bold text-pink-400 whitespace-nowrap">
                      R$ {fmt(product.price)}
                    </span>
                  </div>

                  {product.description && (
                    <p className="text-gray-400 leading-relaxed mb-4">{product.description}</p>
                  )}

                  {product.product_delivery_options.length > 0 && (
                    <p className="text-xs text-gray-500">
                      ⏱ Prazo: a partir de {product.product_delivery_options[0].days} dias úteis
                    </p>
                  )}

                  <div className={`mt-5 flex items-center gap-2 text-sm font-medium transition-all ${isSelected ? "text-pink-400" : "text-gray-500"}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "border-pink-500 bg-pink-500" : "border-white/20"}`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    {isSelected ? "Selecionado" : "Selecionar"}
                  </div>
                </button>
              )
            })}
          </div>
        ) : null}

        {/* ====== STEP 2 — PRAZO DE ENTREGA ====== */}
        {step === 2 && selected && (
          <div className="mb-10">
            {/* Resumo do produto selecionado */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{PRODUCT_ICONS[selected.name] ?? "🎶"}</span>
                <div>
                  <p className="font-semibold">{selected.name}</p>
                  <button onClick={() => setStep(1)} className="text-xs text-pink-400 hover:underline">
                    Trocar produto
                  </button>
                </div>
              </div>
              <span className="text-pink-400 font-bold">R$ {fmt(selected.price)}</span>
            </div>

            <h2 className="text-2xl font-bold mb-2">⏱ Escolha o prazo de entrega</h2>
            <p className="text-gray-400 mb-6">Quanto mais urgente, mais rápido entregamos.</p>

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
                          <p className="text-xs text-gray-400 mt-0.5">
                            + R$ {fmt(opt.price_extra)} de urgência
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-pink-400">R$ {fmt(total)}</p>
                      {opt.price_extra === 0 && (
                        <p className="text-xs text-green-400 mt-0.5">Sem acréscimo</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ERRO CHECKOUT */}
        {checkoutError && (
          <p className="text-center text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            {checkoutError}
          </p>
        )}

        {/* BOTÃO CONTINUAR */}
        <div className="flex flex-col items-center gap-4">
          {step === 1 && selected && selected.product_delivery_options.length === 0 && (
            <button
              onClick={handleContinuar}
              disabled={checkingOut}
              className="px-12 py-5 rounded-3xl text-xl font-bold bg-pink-500 hover:bg-pink-600 shadow-2xl shadow-pink-500/20 hover:scale-105 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {checkingOut ? "Aguarde..." : `Pagar R$ ${fmt(selected.price)} ❤️`}
            </button>
          )}

          {step === 2 && (
            <button
              onClick={handleContinuar}
              disabled={!delivery || checkingOut}
              className={`px-12 py-5 rounded-3xl text-xl font-bold transition-all shadow-2xl ${
                delivery && !checkingOut
                  ? "bg-pink-500 hover:bg-pink-600 shadow-pink-500/20 hover:scale-105"
                  : "bg-white/10 text-gray-500 cursor-not-allowed"
              }`}
            >
              {checkingOut
                ? "Aguarde..."
                : delivery
                ? `Pagar R$ ${fmt(finalPrice)} ❤️`
                : "Selecione um prazo para continuar"}
            </button>
          )}

          <div className="flex gap-8 text-sm text-gray-500">
            <span>🔒 Pagamento seguro</span>
            <span>⚡ Confirmação imediata</span>
            <span>💬 Suporte via WhatsApp</span>
          </div>
        </div>

      </section>
      <Footer />
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
