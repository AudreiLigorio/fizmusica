import fs from "fs"
import path from "path"
import { notFound } from "next/navigation"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"
import BarraHome from "@/app/components/BarraHome"
import LegalBackButton from "./LegalBackButton"

const DOCS: Record<string, { file: string; title: string }> = {
  "termos-de-uso":                { file: "01-termos-de-uso", title: "Termos de Uso" },
  "politica-de-privacidade":      { file: "02-politica-de-privacidade", title: "Política de Privacidade" },
  "consentimento":                { file: "03-consentimento-lgpd", title: "Consentimento de Dados" },
  "autorizacao-dados-terceiros":  { file: "04-autorizacao-dados-terceiros", title: "Autorização de Dados de Terceiros" },
  "licenca-de-uso":               { file: "05-licenca-de-uso-da-musica", title: "Licença de Uso da Música" },
  "reembolso-e-cancelamento":     { file: "06-politica-reembolso-cancelamento", title: "Política de Reembolso e Cancelamento" },
  "autorizacao-de-publicacao":    { file: "07-autorizacao-de-publicacao", title: "Autorização de Publicação" },
  "direitos-autorais":            { file: "08-direitos-autorais-conteudo-enviado", title: "Direitos Autorais e Conteúdo Enviado" },
  "entrega-digital":              { file: "09-termo-de-entrega-digital", title: "Termo de Entrega Digital" },
  "politica-de-cookies":          { file: "10-politica-de-cookies", title: "Política de Cookies" },
}

const fileToSlug: Record<string, string> = Object.fromEntries(
  Object.entries(DOCS).map(([slug, d]) => [d.file, slug])
)

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const doc = DOCS[params.slug]
  return { title: doc ? `${doc.title} — Fiz Música` : "Fiz Música" }
}

export default async function LegalDoc({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = DOCS[slug]
  if (!doc) notFound()

  let content = ""
  try {
    content = fs.readFileSync(path.join(process.cwd(), "legal", `${doc.file}.md`), "utf8")
  } catch {
    notFound()
  }
  // remove o H1 do markdown (já mostramos o título na página)
  content = content.replace(/^#\s.+\n/, "")

  return (
    <div className="min-h-screen text-white font-sans" style={{ background: "#07060d" }}>
      <Header showButton={false} />
      <article className="max-w-2xl mx-auto px-5 pt-24 pb-20">
        <div className="flex items-center gap-5">
          <LegalBackButton />
          <Link href="/legal" className="text-white/40 hover:text-white/70 text-sm">Ver todos os documentos</Link>
        </div>
        <h1 className="text-3xl font-bold mt-3 mb-8">{doc.title}</h1>

        <div className="legal-prose text-gray-300 leading-relaxed text-[15px]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: (p) => <h2 className="text-xl font-bold text-white mt-8 mb-3" {...p} />,
              h3: (p) => <h3 className="text-base font-semibold text-white mt-5 mb-2" {...p} />,
              p:  (p) => <p className="mb-4" {...p} />,
              ul: (p) => <ul className="list-disc pl-5 mb-4 space-y-1" {...p} />,
              ol: (p) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...p} />,
              strong: (p) => <strong className="text-white" {...p} />,
              blockquote: (p) => <blockquote className="border-l-2 border-pink-500/40 pl-4 my-4 text-gray-400" {...p} />,
              hr: () => <hr className="border-white/10 my-6" />,
              table: (p) => <div className="overflow-x-auto my-4"><table className="w-full text-sm border-collapse" {...p} /></div>,
              th: (p) => <th className="text-left border border-white/10 px-3 py-2 bg-white/5" {...p} />,
              td: (p) => <td className="border border-white/10 px-3 py-2 align-top" {...p} />,
              a: ({ href, ...rest }) => {
                let to = href ?? "#"
                const m = to.match(/^(\d{2}-[a-z-]+)\.md$/)
                if (m && fileToSlug[m[1]]) to = `/legal/${fileToSlug[m[1]]}`
                const external = to.startsWith("http") || to.startsWith("mailto")
                return <a href={to} className="text-pink-400 hover:text-pink-300 underline" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest} />
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </article>
      <Footer />
      <BarraHome />
    </div>
  )
}
