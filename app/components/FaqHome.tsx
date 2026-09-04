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
const FAQS: { q: string; a: string }[] = [
  {
    q: "O que é a Fiz Música?",
    a: "É uma plataforma que transforma a sua história em uma música 100% personalizada, com página exclusiva para ouvir, opção de compartilhar e muito mais. Você mesmo personaliza tudo do seu jeito, sem depender de terceiros.",
  },
  {
    q: "Como eu crio a minha música?",
    a: "É simples e guiado: 1) escolha a ocasião e responda algumas perguntas sobre a sua história; 2) escolha o estilo musical e a emoção; 3) selecione o produto; 4) finalize o pagamento. Depois é só aprovar a letra na sua área e a música é produzida. Leva poucos minutos para preencher.",
  },
  {
    q: "O que vem no produto digital?",
    a: "Em todos os planos você recebe a música personalizada, uma página exclusiva (player) para ouvir com a letra acompanhando, a capa criada automaticamente, o arquivo MP3 para baixar e um link para compartilhar. Fotos no player, QR Code e revisão variam conforme o plano — a página de produtos mostra exatamente o que cada um inclui antes de você pagar.",
  },
  {
    q: "Posso editar a letra antes de a música ser produzida?",
    a: "Sim! Depois do pagamento, você gera a letra na sua área, lê com calma e pode pedir ajustes à nossa IA ou editar você mesmo. A música só começa a ser produzida quando você aprovar a letra — então nada é gerado sem o seu OK.",
  },
  {
    q: "Posso colocar fotos na música?",
    a: "Depende do plano: alguns incluem fotos no player, com limites diferentes, e outros não incluem. Quando o seu plano tem fotos, elas aparecem enquanto a música toca, criando um clipe emocional. Você adiciona, troca e remove quando quiser na sua área.",
  },
  {
    q: "Quanto tempo leva para ficar pronta?",
    a: "Assim que você aprova a letra, a produção começa automaticamente e costuma ficar pronta em poucos minutos. Avisamos por e-mail quando estiver disponível. Aí você já pode ouvir, baixar e compartilhar.",
  },
  {
    q: "Como eu recebo e baixo a música?",
    a: "Tudo acontece na sua área (você entra sem senha, com Google ou e-mail). Lá você ouve, baixa o MP3 e compartilha o link. Não enviamos a música anexada por e-mail — o acesso fica seguro e sempre à mão na sua conta.",
  },
  {
    q: "E se eu não gostar do resultado?",
    a: "Nos planos que incluem revisão, você pede direto na sua área contando o que gostaria de mudar, e uma nova versão é gerada. Confira na página de produtos se o plano escolhido inclui revisão.",
  },
  {
    q: "Quem pode ouvir a minha música?",
    a: "Por padrão, só você. A música fica privada na sua área. Ela só chega a outras pessoas de duas formas, e as duas dependem de você: compartilhando o seu link exclusivo com quem quiser, ou publicando na Rede Fiz Música.",
  },
  {
    q: "O que é a Rede Fiz Música?",
    a: "É um espaço dentro da plataforma onde você pode ouvir músicas que outros clientes escolheram publicar — e publicar as suas, se quiser. Dá para favoritar, montar playlists e ver o ranking das mais ouvidas. Publicar é opcional, e você pode retirar a sua música de lá quando quiser, sozinho.",
  },
  {
    q: "Se eu publicar na Rede, minhas fotos aparecem?",
    a: "Não. Na Rede aparece a música, a letra, a ocasião e a capa criada automaticamente — nunca as suas fotos, e nunca o seu nome. As fotos só aparecem para quem você mesmo enviar o seu link exclusivo. Seu apelido só aparece se você ligar essa opção separadamente no perfil.",
  },
  {
    q: "Por quanto tempo o link fica disponível?",
    a: "O link público da música fica no ar por 90 dias, e as fotos são removidas junto com ele no fim desse prazo. O arquivo MP3 e a letra não são apagados: seguem disponíveis na sua área. Mesmo assim, vale baixar e guardar o seu arquivo.",
  },
  {
    q: "Como funcionam os discos e o programa de fidelidade?",
    a: "A cada compra você acumula discos na sua Carreira, e eles vão subindo o seu nível de cantor — de Cantor de Chuveiro a Popstar. Quanto maior o nível, maior o desconto nos próximos produtos digitais. Indicar amigos que compram também rende discos.",
  },
  {
    q: "Vocês avisam quando uma data especial está chegando?",
    a: "Se você quiser. Você cadastra as datas que importam para você (aniversários, namoro, o que for) e mandamos um lembrete por e-mail com antecedência, para dar tempo de preparar a música. Pode remover a data quando quiser.",
  },
  {
    q: "Quais as formas de pagamento?",
    a: "Aceitamos PIX e cartão de crédito (aprovação na hora). O pagamento é processado com segurança pelo Mercado Pago — a gente não armazena os dados do seu cartão.",
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
