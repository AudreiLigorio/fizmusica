import { runHealthChecks, type ServiceCheck } from "@/lib/health"

export const dynamic = "force-dynamic"
export const revalidate = 0

const STATUS_STYLES: Record<ServiceCheck["status"], { dot: string; badge: string; label: string }> = {
  ok: {
    dot: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]",
    badge: "bg-green-500/10 border-green-500/30 text-green-400",
    label: "Operacional",
  },
  error: {
    dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]",
    badge: "bg-red-500/10 border-red-500/30 text-red-400",
    label: "Erro",
  },
  not_configured: {
    dot: "bg-yellow-500/60",
    badge: "bg-yellow-500/10 border-yellow-500/20 text-yellow-500",
    label: "Não configurado",
  },
}

const SERVICE_ICONS: Record<string, string> = {
  Application: "⚡",
  Database:    "🗄️",
  Email:       "📧",
  Storage:     "📦",
  Webhook:     "🔗",
  Pagamentos:  "💳",
  "QR Code":   "📱",
}

const GLOBAL_STYLES: Record<string, { border: string; glow: string; text: string }> = {
  healthy:   { border: "border-green-500/30",  glow: "shadow-[0_0_60px_rgba(34,197,94,0.08)]",    text: "text-green-400" },
  degraded:  { border: "border-yellow-500/30", glow: "shadow-[0_0_60px_rgba(234,179,8,0.08)]",    text: "text-yellow-400" },
  unhealthy: { border: "border-red-500/30",    glow: "shadow-[0_0_60px_rgba(239,68,68,0.08)]",    text: "text-red-400" },
}

export default async function HealthPage() {
  const report = await runHealthChecks()
  const global = GLOBAL_STYLES[report.status]

  const okCount = report.services.filter((s) => s.status === "ok").length
  const total   = report.services.length

  return (
    <div className="min-h-screen bg-black text-white font-sans flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-sm text-gray-500 uppercase tracking-widest mb-3 font-medium">
            Fiz Música · Stack Validation
          </p>
          <h1 className="text-4xl font-bold mb-2">System Health</h1>
          <p className="text-gray-500 text-sm">
            {new Date(report.timestamp).toLocaleString("pt-BR")} · v{report.version}
          </p>
        </div>

        {/* Status global */}
        <div className={`border rounded-3xl p-6 mb-6 flex items-center justify-between ${global.border} ${global.glow} bg-white/3`}>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Status geral</p>
            <p className={`text-2xl font-bold capitalize ${global.text}`}>
              {report.status === "healthy" ? "Saudável" : report.status === "degraded" ? "Degradado" : "Indisponível"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Serviços OK</p>
            <p className="text-2xl font-bold text-white">{okCount}<span className="text-gray-500 text-lg">/{total}</span></p>
          </div>
        </div>

        {/* Serviços */}
        <div className="space-y-3">
          {report.services.map((service) => {
            const s = STATUS_STYLES[service.status]
            return (
              <div
                key={service.name}
                className="bg-white/4 border border-white/8 rounded-2xl px-6 py-4 flex items-center gap-4"
              >
                <span className="text-2xl w-8 text-center">{SERVICE_ICONS[service.name] ?? "🔧"}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm">{service.name}</span>
                    {service.latency_ms !== undefined && (
                      <span className="text-xs text-gray-600">{service.latency_ms}ms</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{service.message}</p>
                </div>

                <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${s.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legenda pendências */}
        <div className="mt-8 bg-yellow-500/5 border border-yellow-500/15 rounded-2xl p-5">
          <p className="text-xs font-semibold text-yellow-500 uppercase tracking-widest mb-3">
            Pendências da Fase 0.5
          </p>
          <ul className="space-y-1.5 text-sm text-gray-400">
            <li>· Configure <code className="text-yellow-400">NEXT_PUBLIC_SUPABASE_URL</code> e <code className="text-yellow-400">SUPABASE_SERVICE_ROLE_KEY</code> no .env.local</li>
            <li>· Configure <code className="text-yellow-400">RESEND_API_KEY</code> no .env.local</li>
            <li>· Configure <code className="text-yellow-400">MP_ACCESS_TOKEN</code> (Mercado Pago Sandbox) no .env.local</li>
            <li>· Configure <code className="text-yellow-400">N8N_WEBHOOK_URL</code> no .env.local</li>
            <li>· QR Code lib será instalada na Fase 8</li>
          </ul>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-700 mt-8">
          <a href="/" className="hover:text-gray-500 transition-colors">← Voltar ao início</a>
          {" · "}
          <a href="/api/health" className="hover:text-gray-500 transition-colors">JSON endpoint</a>
        </p>
      </div>
    </div>
  )
}
