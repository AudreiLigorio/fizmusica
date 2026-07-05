import { createServerClient } from "@/lib/supabase"
import Link from "next/link"
import ResolveButton from "./ResolveButton"
import { fmtDateTimeBR } from "@/lib/date"
import { getCreditBalance } from "@/lib/suno/client"

export const dynamic = "force-dynamic"

type Alert = {
  id: string
  orderId: string
  type: string
  mpPaymentId: string | null
  previousMpPaymentId: string | null
  amount: number | null
  message: string | null
  resolved: boolean
  created_at: string
}

async function getAlerts(): Promise<Alert[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("payment_alerts")
    .select("*")
    .order("created_at", { ascending: false })
  return (data as Alert[]) ?? []
}

const fmt = fmtDateTimeBR

async function getSunoBalance(): Promise<{ credits: number | null; error: string | null }> {
  try {
    return { credits: await getCreditBalance(), error: null }
  } catch (e) {
    return { credits: null, error: e instanceof Error ? e.message : "Erro desconhecido" }
  }
}

export default async function AdminLogs() {
  const [alerts, suno] = await Promise.all([getAlerts(), getSunoBalance()])
  const open = alerts.filter((a) => !a.resolved)

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Logs &amp; Alertas</h1>
      <p className="text-gray-500 text-sm mb-6">
        {open.length > 0
          ? `${open.length} alerta${open.length !== 1 ? "s" : ""} em aberto`
          : "Nenhum alerta em aberto"} · {alerts.length} no total
      </p>

      <h2 className="text-base font-semibold mb-3">Consumo de APIs</h2>
      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎵</span>
            <span className="text-sm font-semibold">Suno (KIE.ai)</span>
          </div>
          {suno.credits != null ? (
            <p className="text-2xl font-bold text-green-400">
              {suno.credits.toLocaleString("pt-BR")} <span className="text-sm font-normal text-gray-500">créditos disponíveis</span>
            </p>
          ) : (
            <p className="text-sm text-red-400">Erro ao consultar: {suno.error}</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">✨</span>
            <span className="text-sm font-semibold">Gemini (Google AI Studio)</span>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            A API do Gemini não tem endpoint de saldo/consumo — precisa consultar direto no painel do Google.
          </p>
          <a
            href="https://aistudio.google.com/usage"
            target="_blank" rel="noopener noreferrer"
            className="inline-block text-xs font-semibold bg-pink-500/15 text-pink-300 px-3 py-2 rounded-lg hover:bg-pink-500/25 transition-colors"
          >
            Consultar no Google AI Studio ↗
          </a>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-4">✅</p>
          <p>Nenhum alerta registrado. Tudo certo por aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`rounded-2xl border p-5 ${
                a.resolved
                  ? "bg-black/20 border-white/5 opacity-60"
                  : "bg-red-500/5 border-red-500/20"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{a.resolved ? "✅" : "⚠️"}</span>
                  <span className="text-sm font-semibold">
                    {a.type === "DUPLICATE_PAYMENT" ? "Possível pagamento duplicado" : a.type}
                  </span>
                  {!a.resolved && (
                    <span className="text-[10px] uppercase tracking-wide bg-red-500/15 text-red-300 px-2 py-0.5 rounded-full">aberto</span>
                  )}
                </div>
                <ResolveButton id={a.id} resolved={a.resolved} />
              </div>

              {a.message && <p className="text-sm text-gray-300 mb-3">{a.message}</p>}

              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div className="flex justify-between sm:block">
                  <span className="text-gray-500">Pedido</span>{" "}
                  <Link href={`/admin/pedidos/${a.orderId}`} className="text-pink-300 font-mono hover:underline">
                    #{a.orderId.slice(0, 8).toUpperCase()}
                  </Link>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-gray-500">Data</span> <span className="text-gray-400">{fmt(a.created_at)}</span>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-gray-500">Pagamento registrado</span>{" "}
                  <span className="font-mono text-gray-400">{a.previousMpPaymentId ?? "—"}</span>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-gray-500">Novo (duplicado?)</span>{" "}
                  {a.mpPaymentId ? (
                    <a
                      href={`https://www.mercadopago.com.br/activities/1/detail?id=${a.mpPaymentId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="font-mono text-blue-400 hover:underline"
                    >
                      {a.mpPaymentId} ↗
                    </a>
                  ) : "—"}
                </div>
                {a.amount != null && (
                  <div className="flex justify-between sm:block">
                    <span className="text-gray-500">Valor</span>{" "}
                    <span className="text-gray-400">R$ {Number(a.amount).toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
