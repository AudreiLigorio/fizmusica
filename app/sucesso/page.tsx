
"use client"
export const dynamic = "force-dynamic"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Header from "../components/Header"
import Footer from "../components/Footer"

function SucessoContent() {

    const searchParams = useSearchParams()

const nome = searchParams.get("nome")
const email = searchParams.get("email")
const whatsapp = searchParams.get("whatsapp")
const cidade = searchParams.get("cidade")
const historia = searchParams.get("historia")
const homenageado = searchParams.get("homenageado")
const dataEspecial = searchParams.get("data_especial")
const estilo = searchParams.get("estilo")
const artista = searchParams.get("artista")

const mensagem = `
Olá! Acabei de solicitar minha música personalizada 🎵

👤 Nome: ${nome}
📧 Email: ${email}
📱 WhatsApp: ${whatsapp}
📍 Cidade: ${cidade}

❤️ Homenageado(a): ${homenageado}
📅 Data especial: ${dataEspecial}

🎶 Estilo musical: ${estilo}
🎤 Inspiração: ${artista}

📝 História:
${historia}
`

  return (
    <div className="min-h-screen bg-black text-white">

    

<Header />

      {/* CONTEÚDO */}
      <div className="flex items-center justify-center px-6 pt-40 pb-16">

        <div className="max-w-2xl w-full bg-white/5 border border-white/10 rounded-[32px] p-10 backdrop-blur-xl shadow-2xl">

          <div className="text-center mb-10">

            <div className="text-6xl mb-6">
              🎵
            </div>

            <h1 className="text-4xl font-bold mb-6">
              Recebemos o seu pedido com sucesso!
            </h1>

            <p className="text-xl text-gray-300 leading-relaxed">
              Sua história foi enviada para nossa equipe e agora iniciaremos o processo de criação da sua música personalizada.
            </p>

          </div>

          <div className="bg-pink-500/10 border border-pink-500/20 rounded-3xl p-8 mb-8">

            <h2 className="text-2xl font-bold mb-6">
              Próximos passos ❤️
            </h2>

            <div className="space-y-5 text-gray-300">

              <div className="flex gap-4">
                <span>1️⃣</span>
                <p>
                  Nossa equipe irá analisar as informações enviadas.
                </p>
              </div>

              <div className="flex gap-4">
                <span>2️⃣</span>
                <p>
                  Entraremos em contato pelo WhatsApp informado.
                </p>
              </div>

              <div className="flex gap-4">
                <span>3️⃣</span>
                <p>
                  Você receberá o link de pagamento seguro.
                </p>
              </div>

              <div className="flex gap-4">
                <span>4️⃣</span>
                <p>
                  Após a confirmação do pagamento iniciaremos a produção da música.
                </p>
              </div>

            </div>

          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
<a
  href={`https://wa.me/5511986858927?text=${encodeURIComponent(mensagem)}`}
  target="_blank"
  className="
    block
    w-full
    bg-green-500
    hover:bg-green-600
    transition-all
    py-5
    rounded-2xl
    text-center
    text-2xl
    font-bold
    shadow-2xl
    shadow-green-500/20
    mt-8
  "
>
  Continuar no WhatsApp 💬
</a>
            <p className="text-gray-300">
              ⚠️ Toda comunicação será realizada pelo WhatsApp informado no formulário.
            </p>

          </div>

        </div>

      </div>
<Header showButton={false} />
    </div>
  )
}
export default function Sucesso() {
  return (
    <Suspense fallback={null}>
      <SucessoContent />
    </Suspense>
  )
  
}