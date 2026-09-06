"use client"

import { useState } from "react"

// FAQ da home.
//
// Revisada em 2026-09-04 junto com os documentos legais. Duas regras que
// vieram dessa revisão e valem para qualquer texto novo aqui:
//
// 1. NÃO prometer recurso que varia por plano como se fosse de todos. Fotos,
//    QR Code e revisão dependem do produto contratado — a versão anterior
//    dizia "no digital você recebe ... suas fotos ... e um QR Code", o que
//    não vale para o plano de entrada.
// 2. NÃO dizer "nossa equipe" para etapa automatizada. A produção é online e
//    imediata; falar em equipe cria expectativa de uma pessoa avaliando.
// 3. Esta FAQ é de quem está DECIDINDO COMPRAR. Dúvida de operação — como
//    aprovo a letra, como baixo, como favorito — mora na ajuda da aba
//    correspondente (AjudaCliente.tsx), não aqui. As que também são objeção
//    de venda ("posso ajustar a letra?", "e se eu não gostar?") ficam nos
//    dois lugares, mas aqui em UMA linha: aqui a pessoa quer saber se pode,
//    lá ela quer saber como.
const FAQS: { q: string; a: string }[] = [
  {
    q: "O que é a Fiz Música?",
    a: "Uma plataforma que transforma a sua história em uma música 100% personalizada, com página exclusiva pra ouvir e link pra compartilhar. Você monta tudo sozinho, sem depender de ninguém.",
  },
  {
    q: "Como funciona?",
    a: "Quatro passos: conte a história, escolha o estilo e a emoção, escolha o produto e pague. Depois é só aprovar a letra na sua área — a partir daí a música é produzida sozinha.",
  },
  {
    q: "Preciso criar uma conta?",
    a: "Sim, mas sem senha: você entra com o Google ou por um link enviado ao seu e-mail. É onde a sua música fica guardada.",
  },
  {
    q: "Quanto custa e como eu pago?",
    a: "Há produtos de diferentes tamanhos — a página de produtos mostra o preço e o que cada um inclui antes de você pagar. Aceitamos PIX e cartão de crédito, processados pelo Mercado Pago; não guardamos os dados do seu cartão.",
  },
  {
    q: "Quanto tempo leva pra ficar pronta?",
    a: "Poucos minutos depois que você aprova a letra. Avisamos por e-mail quando estiver disponível.",
  },
  {
    q: "Serve pra homenagem e pra criar uma música do zero?",
    a: "As duas coisas. Dá pra homenagear alguém — aniversário, namoro, casamento, mãe, pai, filhos, avós, amigos, chá revelação, pets, conquistas — ou partir pra uma composição livre, só sua, sem homenagem nenhuma.",
  },
  {
    q: "O que vem no produto?",
    a: "Em todos: a música, a página exclusiva com a letra acompanhando, a capa criada automaticamente, o MP3 pra baixar e o link pra compartilhar. Fotos no player, QR Code e revisão variam conforme o produto.",
  },
  {
    q: "Posso ajustar a letra antes de a música ser produzida?",
    a: "Pode. Você lê com calma, pede ajustes à IA ou edita você mesmo. Nada é produzido antes do seu OK.",
  },
  {
    q: "E se eu não gostar do resultado?",
    a: "Nos produtos que incluem revisão, você conta o que gostaria de mudar e uma nova versão é gerada. Confira na página de produtos se o produto escolhido inclui.",
  },
  {
    q: "Quem pode ouvir a minha música?",
    a: "Por padrão, só você. Ela chega a outras pessoas de duas formas, e as duas dependem de você: mandando o seu link exclusivo, ou publicando na Rede Fiz Música.",
  },
  {
    q: "O que é a Rede Fiz Música?",
    a: "Um espaço onde dá pra ouvir músicas que outros clientes escolheram publicar — e publicar as suas, se quiser. Publicar é opcional e reversível, e as suas fotos nunca aparecem lá: só a capa criada automaticamente.",
  },
  {
    q: "O que são os discos e o programa de fidelidade?",
    a: "A cada compra você acumula discos e sobe de nível na sua Carreira, de Cantor de Chuveiro a Popstar. Quanto maior o nível, maior o desconto nas próximas músicas. Indicar amigos que compram também rende discos.",
  },
  {
    q: "Por quanto tempo o link fica disponível?",
    a: "O link público fica no ar por 90 dias, e as fotos saem junto no fim do prazo. O MP3 e a letra não são apagados — seguem na sua área. Mesmo assim, vale baixar e guardar.",
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
