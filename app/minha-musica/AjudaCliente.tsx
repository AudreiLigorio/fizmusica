"use client"

import { useState } from "react"

const ITENS: { q: string; a: string }[] = [
  {
    q: "Como eu “valido” a minha música?",
    a: "Você valida aprovando a LETRA. Depois de pagar, gere a letra, ajuste o que quiser e clique em “Aprovar e gerar minha música”. É essa aprovação que inicia a produção. ⚠️ Atenção: ao aprovar, a música é gerada automaticamente e, a partir daí, nada pode ser alterado — nem a letra, nem as fotos.",
  },
  {
    q: "Quantas vezes posso revisar a letra antes de aprovar?",
    a: "A primeira letra é gerada gratuitamente e você ainda tem até 3 revisões com a IA (é só descrever o ajuste e pedir). Depois que as revisões acabarem, você ainda pode editar o texto à mão e aprovar do jeito que quiser.",
  },
  {
    q: "Como adiciono fotos? Quantas posso colocar?",
    a: "No passo de fotos, você adiciona imagens que aparecem no player enquanto a música toca (como um clipe) — a quantidade varia de acordo com o produto escolhido. As fotos são opcionais — se não quiser, é só pular. Você pode trocar ou remover as fotos até aprovar a letra; depois disso elas ficam travadas.",
  },
  {
    q: "A imagem de capa sou eu que escolho?",
    a: "Não. A capa é uma imagem criada automaticamente para a sua música. As fotos que você envia aparecem no carrossel durante a reprodução, junto da letra — não como capa.",
  },
  {
    q: "O que acontece depois que eu aprovo a letra?",
    a: "A produção começa na hora. Quando a música fica pronta, você recebe duas versões para ouvir. Você fica com as duas e escolhe qual será a principal (a que vai no player e no QR Code). Pode trocar a principal quando quiser.",
  },
  {
    q: "Não gostei da música. Posso pedir revisão?",
    a: "Pode. Na música entregue, use o botão “Não gostei dessa versão”. Você conta o que gostaria de mudar, nossa equipe avalia e o pedido reabre para você ajustar a letra/fotos e gerar uma nova versão.",
  },
  {
    q: "Como ouço, baixo e compartilho?",
    a: "Tudo acontece aqui na sua área. Quando a música é liberada, você aceita o Termo de Entrega e libera o acesso para ouvir, baixar o MP3 e gerar o QR Code para fazer a surpresa e compartilhar o link.",
  },
  {
    q: "Por que minha música ainda não começou?",
    a: "Ela só entra em produção depois que você aprova a letra. Se o pedido está parado em “Aprovar letra”, é porque falta esse passo — assim que aprovar, começamos e avisamos por e-mail quando ficar pronta.",
  },
  {
    q: "O que são as abas “Pagos” e “Não pagos”?",
    a: "Em “Pagos” ficam os pedidos que já podem ser produzidos (aprovar letra, acompanhar e baixar). Em “Não pagos” ficam os que ainda aguardam pagamento — é só finalizar o pagamento para liberar a criação.",
  },
]

export default function AjudaCliente() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="mt-10 border-t border-white/10 pt-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">💡</span>
        <h2 className="text-lg font-semibold text-white">Dúvidas sobre esta tela</h2>
      </div>
      <div className="space-y-2.5">
        {ITENS.map((item, i) => {
          const isOpen = open === i
          return (
            <div
              key={i}
              className="rounded-2xl overflow-hidden transition-colors"
              style={{
                background: isOpen ? "rgba(240,25,107,0.05)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${isOpen ? "rgba(240,25,107,0.25)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-4 text-left px-4 py-3.5"
              >
                <span className="font-medium text-white text-sm leading-snug">{item.q}</span>
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
              <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 text-[13px] text-white/60 leading-relaxed whitespace-pre-line">{item.a}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
