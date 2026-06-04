"use client"

import React, { useEffect, useState } from "react"
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

  function handleContinuar() {
    if (!selected || !orderId) return

    // Vai para a página de checkout com o Payment Brick
    const params = new URLSearchParams({
      orderId,
      productId:   selected.id,
      productName: delivery ? `${selected.name} — ${delivery.label}` : selected.name,
      price:       String(selected.price + (delivery?.price_extra ?? 0)),
      ...(delivery ? { deliveryId: delivery.id } : {}),
    })

    window.location.href = `/checkout?${params.toString()}`
  }

  const finalPrice = selected
    ? selected.price + (delivery?.price_extra ?? 0)
    : 0

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

        {/* Mobile: barra de step no topo */}
        <div className="lg:hidden shrink-0 px-5 pt-4 pb-2 flex items-center justify-between">
          {step === 2 ? (
            <button onClick={() => setStep(1)} className="text-white/50 text-sm">← Voltar</button>
          ) : <div />}
          <div className="flex items-center gap-2">
            {[1, 2].map((n) => (
              <div key={n} className={`h-1 rounded-full transition-all duration-300 ${
                n <= step ? "w-8" : "w-4"
              }`} style={{ background: n <= step ? "linear-gradient(90deg,#f0196b,#d946ef)" : "rgba(255,255,255,0.1)" }} />
            ))}
          </div>
          <div />
        </div>

        {/* Área de conteúdo */}
        <div className="flex-1 overflow-y-auto lg:overflow-visible">
          <div className="px-5 py-4 pb-32 lg:pb-0 lg:max-w-5xl lg:mx-auto lg:px-6 lg:py-12">

            {/* TOPO */}
            <div className="mb-6 lg:text-center lg:mb-14">
              <h1 className="text-xl lg:text-4xl font-bold mb-1 leading-tight">
                Selecione o produto ideal para transformar esse momento inesquecível
              </h1>
            </div>

            {/* INDICADOR DE STEPS — desktop only */}
            <div className="hidden lg:flex items-center justify-center gap-3 mb-10">
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
                        ? "bg-white/5 border border-white/10 text-gray-200 hover:text-white cursor-pointer"
                        : "bg-white/5 border border-white/5 text-gray-200 cursor-default"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      step > n ? "bg-pink-500 text-white" : step === n ? "bg-pink-500 text-white" : "bg-white/10 text-gray-300"
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

                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                       style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 4px 20px rgba(240,25,107,0.3)" }}>
                    {icon}
                  </div>

                  <div className="flex items-start justify-between mb-4 gap-4">
                    <h3 className="text-2xl font-bold leading-tight">{product.name}</h3>
                    <span className="text-2xl font-bold text-pink-400 whitespace-nowrap">
                      R$ {fmt(product.price)}
                    </span>
                  </div>

                  {product.description && (
                    <p className="text-gray-200 leading-relaxed mb-4">{product.description}</p>
                  )}

                  {product.product_delivery_options.length > 0 && (
                    <p className="text-xs text-gray-300">
                      ⏱ Prazo: a partir de {product.product_delivery_options[0].days} dias úteis
                    </p>
                  )}

                  <div className={`mt-5 flex items-center gap-2 text-sm font-medium transition-all ${isSelected ? "text-pink-400" : "text-gray-300"}`}>
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
                          <p className="text-xs text-gray-200 mt-0.5">
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

            {/* BOTÃO CONTINUAR — desktop */}
            <div className="hidden lg:flex flex-col items-center gap-4 mt-4">
              {step === 1 && selected && selected.product_delivery_options.length === 0 && (
                <button
                  onClick={handleContinuar}
                  className="px-12 py-5 rounded-3xl text-xl font-bold hover:brightness-110 transition-all"
                  style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)", boxShadow: "0 8px 32px rgba(240,25,107,0.35)" }}
                >
                  Ir para pagamento ❤️
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={handleContinuar}
                  disabled={!delivery}
                  className="px-12 py-5 rounded-3xl text-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: delivery ? "linear-gradient(135deg,#f0196b,#d946ef)" : "rgba(255,255,255,0.08)", boxShadow: delivery ? "0 8px 32px rgba(240,25,107,0.35)" : "none", color: delivery ? "white" : "rgba(255,255,255,0.3)" }}
                >
                  {delivery ? `Ir para pagamento — R$ ${fmt(finalPrice)} ❤️` : "Selecione um prazo para continuar"}
                </button>
              )}
              <div className="flex gap-8 text-sm text-gray-300">
                <span>🔒 Pagamento seguro</span>
                <span>⚡ Confirmação imediata</span>
                <span>💬 Suporte via WhatsApp</span>
              </div>
            </div>

          </div>{/* fecha px-5 / lg:max-w-5xl */}
        </div>{/* fecha flex-1 overflow-y-auto */}

        {/* BOTÃO FIXO NO RODAPÉ — mobile */}
        {(step === 1 && selected && selected.product_delivery_options.length === 0) || step === 2 ? (
          <div className="lg:hidden shrink-0 px-5 py-4 border-t border-white/[0.06]"
               style={{ background: "rgba(7,6,13,0.95)", backdropFilter: "blur(16px)" }}>
            {step === 2 && !delivery ? (
              <div className="w-full py-4 rounded-2xl text-sm font-semibold text-center text-white/55"
                   style={{ background: "rgba(255,255,255,0.06)" }}>
                Selecione um prazo para continuar
              </div>
            ) : (
              <button
                onClick={handleContinuar}
                disabled={step === 2 && !delivery}
                className="w-full py-4 rounded-2xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)", boxShadow: "0 4px 20px rgba(240,25,107,0.35)" }}
              >
                Ir para pagamento ❤️
              </button>
            )}
            <p className="text-center text-xs text-white/25 mt-2">🔒 Pagamento seguro · ⚡ Confirmação imediata</p>
          </div>
        ) : null}

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

