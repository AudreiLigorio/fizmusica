"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"

type Order = {
  id: string
  context: string
  subcategory: string
  status: string
  paymentStatus: string
  createdAt: string
  photo_token?: string | null
  slug?: string | null
  products?: { name: string; price: number } | null
  payments?: { amount: number; mpStatus: string | null } | null
}

const STEPS = [
  { key: "PAID",          label: "Pago" },
  { key: "IN_PRODUCTION", label: "Em produção" },
  { key: "DELIVERED",     label: "Pronta" },
]

function stepState(order: Order, key: string): "done" | "current" | "todo" {
  const paid = order.paymentStatus === "PAID"
  const reached: Record<string, boolean> = {
    PAID:          paid,
    IN_PRODUCTION: paid && (order.status === "IN_PRODUCTION" || order.status === "DELIVERED"),
    DELIVERED:     order.status === "DELIVERED",
  }
  if (order.status === "DELIVERED") return reached[key] ? "done" : "todo"
  // etapa atual = a primeira alcançada de trás pra frente
  if (key === "IN_PRODUCTION" && reached.IN_PRODUCTION) return "current"
  if (key === "PAID" && paid && !reached.IN_PRODUCTION) return "current"
  return reached[key] ? "done" : "todo"
}

function MinhaMusicaContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const orderId      = searchParams.get("orderId")

  const [user, setUser]     = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

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
    fetch(`/api/orders?email=${encodeURIComponent(user.email!)}`)
      .then((r) => r.json())
      .then((d) => { setOrders(d.orders ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user])

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

  return (
    <div className="relative min-h-screen text-white font-sans overflow-hidden" style={{ background: "#07060d" }}>
      {/* Fundo gradiente da marca */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0" style={{ background: "radial-gradient(55% 45% at 12% 6%, rgba(240,25,107,0.26) 0%, transparent 60%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(55% 50% at 90% 96%, rgba(168,85,247,0.24) 0%, transparent 62%)" }} />
      </div>

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

          {/* Criar nova música */}
          <button
            onClick={() => router.push("/criar")}
            className="w-full rounded-2xl p-5 mb-6 text-left flex items-center justify-between transition-transform hover:scale-[1.01]"
            style={{ background: "linear-gradient(135deg, #f0196b, #d946ef, #a855f7)", boxShadow: "0 12px 40px rgba(217,70,239,0.3)" }}
          >
            <div>
              <p className="font-bold text-lg">+ Criar nova música</p>
              <p className="text-white/80 text-sm">Para outra pessoa ou ocasião especial</p>
            </div>
            <span className="text-2xl">🎵</span>
          </button>

          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Meus pedidos</p>

          {orders.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white/[0.03] border border-white/10 rounded-2xl">
              <p className="text-4xl mb-3">🎵</p>
              <p>Nenhum pedido encontrado para este e-mail.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const paid = order.paymentStatus === "PAID"
                const delivered = order.status === "DELIVERED"
                return (
                  <div key={order.id} className="bg-white/[0.04] border border-white/10 rounded-2xl p-6">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="font-semibold text-lg">{order.subcategory}</p>
                        <p className="text-xs text-gray-400">
                          {order.products?.name ?? order.context} · #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                      {order.payments?.amount && (
                        <p className="text-pink-400 font-bold whitespace-nowrap">
                          R$ {Number(order.payments.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>

                    {/* Linha do tempo */}
                    {paid && (
                      <div className="flex items-center mb-5">
                        {STEPS.map((s, i) => {
                          const st = stepState(order, s.key)
                          return (
                            <div key={s.key} className="flex items-center flex-1 last:flex-none">
                              <div className="flex flex-col items-center">
                                <span className={`w-3.5 h-3.5 rounded-full ${
                                  st === "done" ? "bg-green-400" : st === "current" ? "bg-fuchsia-400 animate-pulse" : "bg-white/15"
                                }`} />
                                <span className={`text-[10px] mt-1 ${st === "todo" ? "text-gray-600" : "text-gray-300"}`}>{s.label}</span>
                              </div>
                              {i < STEPS.length - 1 && (
                                <span className={`h-0.5 flex-1 mx-1 mb-4 ${st === "done" ? "bg-green-400/60" : "bg-white/10"}`} />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {!paid && (
                      <p className="text-yellow-400 text-sm mb-4">⏳ Aguardando confirmação do pagamento</p>
                    )}

                    {/* Ações */}
                    <div className="flex flex-wrap gap-2">
                      {delivered && order.slug && (
                        <a
                          href={`/m/${order.slug}`}
                          className="flex-1 min-w-[140px] text-center bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:opacity-90 transition-opacity py-2.5 rounded-xl text-sm font-bold"
                        >
                          ▶ Ouvir minha música
                        </a>
                      )}
                      {paid && order.photo_token && (
                        <a
                          href={`/pedido/${order.photo_token}/fotos`}
                          className="flex-1 min-w-[140px] text-center bg-white/10 border border-pink-500/30 hover:bg-white/15 transition-colors py-2.5 rounded-xl text-sm font-medium text-pink-300"
                        >
                          📸 Adicionar fotos
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
