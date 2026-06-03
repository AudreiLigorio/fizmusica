"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"

const STATUS_LABEL: Record<string, string> = {
  PENDING:       "⏳ Aguardando produção",
  IN_PRODUCTION: "🎵 Em produção",
  DELIVERED:     "✅ Entregue",
  ABANDONED:     "❌ Cancelado",
}

const PAYMENT_LABEL: Record<string, string> = {
  UNPAID:   "Não pago",
  PAID:     "✅ Pago",
  REFUNDED: "Reembolsado",
}

type Order = {
  id: string
  context: string
  subcategory: string
  status: string
  paymentStatus: string
  createdAt: string
  products?: { name: string; price: number } | null
  payments?: { amount: number; mpStatus: string | null } | null
}

function MinhaMusica2() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const orderId      = searchParams.get("orderId")

  const [user, setUser]     = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  // Verifica sessão
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser(data.session.user)
      } else {
        // Sem sessão — redireciona para login
        router.push("/entrar")
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
      } else {
        router.push("/entrar")
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [router])

  // Busca pedidos do cliente pelo e-mail
  useEffect(() => {
    if (!user) return

    const url = orderId
      ? `/api/orders/${orderId}`
      : `/api/orders?email=${encodeURIComponent(user.email!)}`

    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (orderId) {
          setOrders(d.order ? [d.order] : [])
        } else {
          setOrders(d.orders ?? [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user, orderId])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/")
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans pt-24">
      <Header showButton={false} />

      <section className="max-w-3xl mx-auto px-6 py-12">

        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold">Minha música ❤️</h1>
            <p className="text-gray-500 mt-1 text-sm">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-400 transition-colors"
          >
            Sair
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-5xl mb-4">🎵</p>
            <p>Nenhum pedido encontrado para este e-mail.</p>
            <button
              onClick={() => router.push("/criar")}
              className="mt-6 bg-pink-500 hover:bg-pink-600 px-8 py-3 rounded-2xl font-semibold transition-colors"
            >
              Criar minha música
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white/5 border border-white/10 rounded-2xl p-6"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="font-semibold text-lg">{order.subcategory}</p>
                    <p className="text-sm text-gray-500">{order.context}</p>
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${
                    order.status === "DELIVERED"
                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                      : order.status === "IN_PRODUCTION"
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                  }`}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {order.products && (
                    <div className="bg-black/30 rounded-xl p-3">
                      <p className="text-gray-500 text-xs mb-1">Produto</p>
                      <p className="font-medium">{order.products.name}</p>
                    </div>
                  )}
                  <div className="bg-black/30 rounded-xl p-3">
                    <p className="text-gray-500 text-xs mb-1">Pagamento</p>
                    <p className={`font-medium ${order.paymentStatus === "PAID" ? "text-green-400" : "text-gray-300"}`}>
                      {PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus}
                    </p>
                  </div>
                  {order.payments?.amount && (
                    <div className="bg-black/30 rounded-xl p-3">
                      <p className="text-gray-500 text-xs mb-1">Valor</p>
                      <p className="font-medium text-pink-400">
                        R$ {Number(order.payments.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  <div className="bg-black/30 rounded-xl p-3">
                    <p className="text-gray-500 text-xs mb-1">Data</p>
                    <p className="font-medium text-gray-300">
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  )
}

export default function MinhaMusica() {
  return (
    <Suspense

      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MinhaMusica2 />
    </Suspense>
  )
}
