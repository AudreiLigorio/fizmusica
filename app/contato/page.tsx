"use client"

import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"
import BarraHome from "@/app/components/BarraHome"

const WHATSAPP = "5511996645678"
const WHATSAPP_LABEL = "(11) 99664-5678"
const EMAIL = "contato@fizmusica.com.br"
const EMAIL_PRIV = "privacidade@fizmusica.com.br"

const waLink = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
  "Olá! Preciso de ajuda com a Fiz Música.\n\nNº do pedido: \nAssunto: "
)}`

export default function ContatoPage() {
  return (
    <div className="relative min-h-screen text-white font-sans overflow-hidden" style={{ background: "#07060d" }}>
      {/* Fundo gradiente da marca */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0" style={{ background: "radial-gradient(55% 45% at 12% 6%, rgba(240,25,107,0.24) 0%, transparent 60%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(55% 50% at 90% 96%, rgba(168,85,247,0.22) 0%, transparent 62%)" }} />
      </div>

      <div className="relative z-10">
        <Header showButton={false} />

        <section className="max-w-2xl mx-auto px-5 pt-28 pb-16">
          {/* Cabeçalho */}
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">💬</div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
              Fale com a <span className="bg-gradient-to-r from-pink-400 to-fuchsia-500 bg-clip-text text-transparent">gente</span>
            </h1>
            <p className="text-gray-300 leading-relaxed mt-3 max-w-md mx-auto">
              Estamos <strong className="text-white">sempre à disposição</strong> para ajudar você — antes, durante ou depois da sua música.
              Pode falar com a gente que respondemos com carinho. ❤️
            </p>
          </div>

          {/* WhatsApp — canal principal */}
          <a
            href={waLink}
            target="_blank" rel="noopener noreferrer"
            className="group block rounded-3xl p-6 mb-4 transition-transform hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.14), rgba(16,185,129,0.10))", border: "1px solid rgba(34,197,94,0.30)" }}
          >
            <div className="flex items-center gap-4">
              <span className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-green-300/80">Mais rápido</p>
                <p className="text-lg font-bold">WhatsApp</p>
                <p className="text-sm text-white/60">{WHATSAPP_LABEL}</p>
              </div>
              <span className="ml-auto text-green-300 group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </a>

          {/* E-mails */}
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <a href={`mailto:${EMAIL}`} className="rounded-2xl p-5 border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
              <p className="text-[11px] font-bold uppercase tracking-widest text-pink-300/80 mb-1">E-mail geral</p>
              <p className="text-sm font-medium break-all">{EMAIL}</p>
              <p className="text-xs text-white/40 mt-1">Dúvidas, pedidos e suporte</p>
            </a>
            <a href={`mailto:${EMAIL_PRIV}`} className="rounded-2xl p-5 border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
              <p className="text-[11px] font-bold uppercase tracking-widest text-fuchsia-300/80 mb-1">Privacidade</p>
              <p className="text-sm font-medium break-all">{EMAIL_PRIV}</p>
              <p className="text-xs text-white/40 mt-1">Dados pessoais e LGPD</p>
            </a>
          </div>

          {/* Dica: o que ter em mãos */}
          <div className="rounded-2xl p-5 border border-pink-500/20 bg-pink-500/[0.05]">
            <p className="text-sm font-semibold text-pink-200 mb-2">📋 Para agilizar seu atendimento, tenha em mãos:</p>
            <ul className="space-y-1.5 text-sm text-white/70">
              <li className="flex items-start gap-2"><span className="text-pink-400">•</span> O <strong className="text-white">número do pedido</strong> (aparece na tela de sucesso e nos e-mails)</li>
              <li className="flex items-start gap-2"><span className="text-pink-400">•</span> O <strong className="text-white">comprovante de pagamento</strong>, caso a dúvida seja sobre cobrança</li>
              <li className="flex items-start gap-2"><span className="text-pink-400">•</span> O <strong className="text-white">e-mail usado na compra</strong></li>
              <li className="flex items-start gap-2"><span className="text-pink-400">•</span> Uma breve descrição do que você precisa</li>
            </ul>
          </div>

          <p className="text-center text-white/40 text-xs mt-8">
            Atendimento de segunda a sábado. Fora do horário, deixe sua mensagem que retornamos assim que possível.
          </p>
        </section>

        <Footer />
      </div>
      <BarraHome />
    </div>
  )
}
