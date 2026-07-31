import Link from "next/link"
import CtaTema from "./CtaTema"
import { notFound } from "next/navigation"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"
import { TEMAS, getTema } from "@/lib/content/temas"

// Landing por tema — destino dos links rastreados (/r/<slug>). Quem chega aqui
// veio de um post sobre ESTE assunto: a página continua a conversa em vez de
// mandar a pessoa recomeçar na home.

export function generateStaticParams() {
  return TEMAS.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tema = getTema(slug)
  if (!tema) return { title: "Fiz Música" }
  return {
    title: `${tema.titulo} — Fiz Música`,
    description: tema.sub,
  }
}

export default async function TemaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tema = getTema(slug)
  if (!tema) notFound()

  return (
    <div className="min-h-screen text-white font-sans" style={{ background: "#07060d" }}>
      <Header showButton={false} />

      <section className="max-w-2xl mx-auto px-5 pt-24 pb-16">
        <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-4">{tema.h1}</h1>
        <p className="text-white/70 text-lg mb-8">{tema.sub}</p>

        <CtaTema slug={tema.slug} label={`${tema.cta} ❤️`} />

        <ul className="mt-12 space-y-4">
          {tema.bullets.map((b) => (
            <li key={b} className="flex gap-3 text-white/80">
              <span className="text-fuchsia-400 shrink-0">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-white/70 text-sm leading-relaxed">
            Você conta a história — os nomes, as manias, o que só vocês sabem. A gente transforma
            isso numa música exclusiva, com letra sincronizada, fotos e um player para presentear.
          </p>
          <Link href="/produtos" className="text-fuchsia-300 text-sm underline hover:text-fuchsia-200 mt-3 inline-block">
            Ver opções e preços
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
