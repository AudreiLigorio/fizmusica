"use client"

import { useState } from "react"

const FAQS: { q: string; a: string }[] = [
  {
    q: "O que é a Fiz Música?",
    a: "É uma plataforma que transforma a sua história em uma música 100% personalizada. Você conta os detalhes, escolhe o estilo e o sentimento, e nós criamos uma canção única — feita para emocionar quem você ama.",
  },
  {
    q: "Como eu crio a minha música?",
    a: "É simples e guiado: 1) escolha a ocasião e responda algumas perguntas sobre a sua história; 2) escolha o estilo musical e a emoção; 3) selecione o produto; 4) finalize o pagamento. Depois é só aprovar a letra na sua área e a música é produzida. Leva poucos minutos para preencher.",
  },
  {
    q: "O que vem no produto digital?",
    a: "No digital você recebe: o arquivo da música em MP3 para baixar, uma página exclusiva (player) com a letra sincronizada e suas fotos, e um QR Code para compartilhar e fazer a surpresa. Tudo fica disponível na sua área, sempre que quiser.",
  },
  {
    q: "E o produto físico, o que muda?",
    a: "Nos produtos físicos você recebe tudo do digital e ainda um item especial (por exemplo, uma placa/quadro com o QR Code da música) entregue no endereço informado. É a sua música ganhando forma para presentear de um jeito ainda mais marcante.",
  },
  {
    q: "Posso editar a letra antes de a música ser produzida?",
    a: "Sim! Depois do pagamento, você gera a letra na sua área, lê com calma e pode pedir ajustes à nossa IA ou editar você mesmo. A música só começa a ser produzida quando você aprovar a letra — então nada é gerado sem o seu OK.",
  },
  {
    q: "Posso colocar fotos na música?",
    a: "Pode! Antes de aprovar, você adiciona fotos que aparecem no player enquanto a música toca, criando um clipe emocional — a quantidade varia de acordo com o produto escolhido. As fotos são opcionais, mas deixam a experiência muito mais especial.",
  },
  {
    q: "Quanto tempo leva para ficar pronta?",
    a: "Assim que você aprova a letra, a produção começa automaticamente e costuma ficar pronta em poucos minutos. Avisamos por e-mail quando a sua música estiver disponível para ouvir e baixar na sua área.",
  },
  {
    q: "Como eu recebo e baixo a música?",
    a: "Tudo acontece na sua área (você entra sem senha, com Google ou e-mail). Lá você ouve, baixa o MP3, gera o QR Code e compartilha o link. Não enviamos a música anexada por e-mail — o acesso fica seguro e sempre à mão na sua conta.",
  },
  {
    q: "E se eu não gostar do resultado?",
    a: "Você pode pedir uma revisão direto na sua área, contando o que gostaria de mudar. Nossa equipe avalia e gera uma nova versão. Queremos que você se emocione de verdade com o resultado.",
  },
  {
    q: "Quais as formas de pagamento?",
    a: "Aceitamos PIX (aprovação na hora), cartão de crédito (em até 5x) e boleto. O pagamento é processado com segurança pelo Mercado Pago — a gente não armazena os dados do seu cartão.",
  },
  {
    q: "A música pode ser para qualquer ocasião?",
    a: "Sim! Aniversário, namoro, casamento, homenagem para mãe, pai, filhos, avós e amigos, chá revelação, pets, conquistas, e até uma composição totalmente livre. Se tem uma história, dá para virar música.",
  },
  {
    q: "Preciso criar uma conta?",
    a: "Você acessa a sua área sem senha — é só entrar com a conta Google ou pelo e-mail usado na compra (login por link mágico). Rápido, simples e seguro.",
  },
]

export default function FaqHome() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="space-y-3" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {FAQS.map((item, i) => {
        const isOpen = open === i
        return (
          <div
            key={i}
            className="rounded-2xl overflow-hidden transition-colors"
            style={{
              background: isOpen ? "rgba(240,25,107,0.05)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${isOpen ? "rgba(240,25,107,0.25)" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 sm:py-5"
            >
              <span className="font-medium text-white text-[15px] leading-snug">{item.q}</span>
              <span
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300"
                style={{
                  background: isOpen ? "#f0196b" : "rgba(255,255,255,0.06)",
                  transform: isOpen ? "rotate(45deg)" : "none",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isOpen ? "#fff" : "rgba(255,255,255,0.6)"} strokeWidth="2.4" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
            </button>
            <div
              className="grid transition-all duration-300 ease-out"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm text-white/60 leading-relaxed">{item.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
