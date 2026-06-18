import Link from "next/link"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"

export const metadata = { title: "Documentos legais — Fiz Música" }

const ITEMS = [
  { slug: "termos-de-uso", title: "Termos de Uso" },
  { slug: "politica-de-privacidade", title: "Política de Privacidade" },
  { slug: "politica-de-cookies", title: "Política de Cookies" },
  { slug: "licenca-de-uso", title: "Licença de Uso da Música" },
  { slug: "reembolso-e-cancelamento", title: "Política de Reembolso e Cancelamento" },
  { slug: "direitos-autorais", title: "Direitos Autorais e Conteúdo Enviado" },
  { slug: "entrega-digital", title: "Termo de Entrega Digital" },
  { slug: "autorizacao-de-publicacao", title: "Autorização de Publicação" },
  { slug: "autorizacao-dados-terceiros", title: "Autorização de Dados de Terceiros" },
  { slug: "consentimento", title: "Consentimento de Dados" },
]

export default function LegalIndex() {
  return (
    <div className="min-h-screen text-white font-sans" style={{ background: "#07060d" }}>
      <Header showButton={false} />
      <section className="max-w-2xl mx-auto px-5 pt-24 pb-20">
        <h1 className="text-3xl font-bold mb-2">Documentos legais</h1>
        <p className="text-gray-400 text-sm mb-8">Última atualização: Junho de 2026</p>
        <div className="space-y-2">
          {ITEMS.map((i) => (
            <Link key={i.slug} href={`/legal/${i.slug}`}
              className="block bg-white/[0.04] border border-white/10 rounded-xl px-5 py-4 hover:bg-white/[0.07] transition-colors">
              {i.title} <span className="text-pink-400 float-right">→</span>
            </Link>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  )
}
