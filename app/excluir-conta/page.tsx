import type { Metadata } from "next"
import Link from "next/link"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"

export const metadata: Metadata = {
  title: "Excluir conta — Fiz Música",
  description: "Como excluir sua conta do Fiz Música e o que acontece com seus dados e suas músicas.",
}

// Página pública de exclusão de conta. É o link que a Play Store pede no
// formulário de segurança de dados ("URL para solicitar exclusão de conta") —
// tem que abrir sem login e explicar o caminho. Com ?feito=1, é também a tela
// final depois que a conta foi apagada pela área do cliente.
export default async function ExcluirContaPage({ searchParams }: { searchParams: Promise<{ feito?: string }> }) {
  const { feito } = await searchParams

  return (
    <div className="min-h-screen text-white font-sans" style={{ background: "#07060d" }}>
      <Header showButton={false} />

      <section className="max-w-2xl mx-auto px-5 pt-28 pb-16">
        {feito ? (
          <div className="text-center bg-white/[0.04] border border-white/15 rounded-3xl p-8">
            <h1 className="text-2xl font-bold mb-3">Sua conta foi excluída</h1>
            <p className="text-white/85 leading-relaxed mb-2">
              Mandamos uma confirmação para o seu e-mail. As músicas que você comprou continuam guardadas, como garante a Licença.
            </p>
            <p className="text-white/85 leading-relaxed mb-6">Obrigado por ter feito parte do Fiz Música.</p>
            <Link href="/" className="inline-block bg-pink-600 hover:bg-pink-700 text-white font-semibold px-6 py-3 rounded-xl">
              Ir para o início
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold mb-3">Excluir sua conta</h1>
            <p className="text-white/85 leading-relaxed mb-8">
              Você pode excluir sua conta do Fiz Música quando quiser, pelo app ou pelo site.
            </p>

            <h2 className="text-xl font-semibold mb-3">Como excluir</h2>
            <ol className="list-decimal pl-5 space-y-2 text-white/90 leading-relaxed mb-8">
              <li><Link href="/entrar" className="underline underline-offset-4">Entre na sua conta</Link> (no app ou em fizmusica.com.br).</li>
              <li>Abra a aba <strong>Carreira</strong>.</li>
              <li>No fim da página, toque em <strong>Excluir minha conta</strong>.</li>
              <li>Digite <strong>EXCLUIR</strong> para confirmar.</li>
            </ol>
            <p className="text-white/85 leading-relaxed mb-8">
              Não consegue entrar? Escreva para{" "}
              <a href="mailto:privacidade@fizmusica.com.br" className="underline underline-offset-4">privacidade@fizmusica.com.br</a>{" "}
              a partir do e-mail da conta, pedindo a exclusão.
            </p>

            <h2 className="text-xl font-semibold mb-3">O que é apagado</h2>
            <p className="text-white/85 leading-relaxed mb-8">
              Seu login, favoritos, playlists, apelido e foto de perfil, datas especiais, código de indicação e seus discos da Carreira. A exclusão é imediata.
            </p>

            <h2 className="text-xl font-semibold mb-3">O que continua guardado</h2>
            <ul className="list-disc pl-5 space-y-2 text-white/85 leading-relaxed mb-8">
              <li>As <strong>músicas que você comprou</strong> (arquivo e letra), que são suas pela Licença. Se criar uma conta de novo com o mesmo e-mail, elas voltam a aparecer.</li>
              <li>Os <strong>registros de pagamento</strong>, pelo prazo que a lei exige.</li>
              <li>As <strong>palmas</strong> que você deu na Rede continuam contando para quem as recebeu, sem o seu nome.</li>
            </ul>

            <h2 className="text-xl font-semibold mb-3">Uma exceção</h2>
            <p className="text-white/85 leading-relaxed">
              Se uma música sua ainda estiver sendo feita, a exclusão fica disponível depois da entrega — para a música não ficar sem ninguém para receber.
              Veja também a <Link href="/legal/politica-de-privacidade" className="underline underline-offset-4">Política de Privacidade</Link>.
            </p>
          </>
        )}
      </section>

      <Footer />
    </div>
  )
}
