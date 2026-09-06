"use client"

import { useState } from "react"

// Ajuda de cada aba da área do cliente.
//
// Duas decisões de formato, tomadas com o Audrei:
//
// 1. SEM sanfona. As respostas cabem em duas linhas, e ler seis respostas
//    curtas é mais rápido do que clicar seis vezes pra descobrir se alguma
//    delas é a sua. Sanfona só faz sentido na home, que tem mais itens.
//
// 2. Entra a pergunta que evita ERRO IRREVERSÍVEL ou perda de dinheiro;
//    curiosidade fica de fora. "Aprovar a letra não tem volta" entra e vem
//    primeiro; "como troco a foto do perfil" não entra, porque o botão já
//    diz. Por isso são 4 a 7 itens por aba, e não os 20 que caberiam.
//
// Regra de escrita: a PRIMEIRA frase já responde. Detalhe vem depois, e só
// se existir. Nada de "nossa equipe" para etapa automatizada, e nada de
// prometer recurso que varia por produto como se fosse de todos — as duas
// armadilhas que a FAQ da home já tinha corrigido e esta tela ainda repetia.

type Item = { q: string; a: string }
export type AbaAjuda = "pedidos" | "musicas" | "carreira"

const POR_ABA: Record<AbaAjuda, { titulo: string; itens: Item[] }> = {
  pedidos: {
    titulo: "Dúvidas sobre o seu pedido",
    itens: [
      {
        q: "Como aprovo a letra?",
        a: "Gere a letra, ajuste o que quiser e toque em “Aprovar e gerar minha música”. Atenção: a aprovação não tem volta — a produção começa na hora e nem a letra nem as fotos mudam depois. Se o seu pedido está parado, é esse o passo que falta.",
      },
      {
        q: "Quantas vezes posso mudar a letra?",
        a: "A primeira sai de graça e você tem mais 3 revisões com a IA — é só descrever o ajuste. Acabando as revisões, ainda dá pra editar o texto à mão antes de aprovar.",
      },
      {
        q: "Como coloco fotos?",
        a: "No passo de fotos, antes de aprovar a letra. Elas aparecem no player enquanto a música toca. São opcionais, a quantidade depende do produto, e depois da aprovação ficam travadas.",
      },
      {
        q: "Recebi duas versões. E agora?",
        a: "As duas são suas. Você escolhe a principal — é a que vai no player, no link e no QR Code. Dá pra trocar quando quiser.",
      },
      {
        q: "Não gostei. Posso pedir outra?",
        a: "Use “Não gostei dessa versão”, conte o que gostaria de mudar e o pedido reabre pra você ajustar letra e fotos. A revisão depende do produto contratado.",
      },
      {
        q: "Como ouço, baixo e compartilho?",
        a: "Aceite o Termo de Entrega e libera tudo de uma vez: player, download do MP3, link pra mandar pra quem quiser e QR Code, quando o seu produto inclui.",
      },
      {
        q: "Publicar na Rede é obrigatório?",
        a: "Não, é opcional e reversível. Publicando, outras pessoas ouvem a música e a letra, e ela ganha um endereço público. As suas fotos nunca aparecem — só a capa. Dá pra desmarcar quando quiser.",
      },
    ],
  },

  musicas: {
    titulo: "Dúvidas sobre a Rede Fiz Música",
    itens: [
      {
        q: "Como escuto?",
        a: "Toque na capa. O player fica embaixo e continua tocando quando você troca de aba — inclusive com a tela do celular bloqueada. Toque nele pra abrir a letra.",
      },
      {
        q: "Como favorito?",
        a: "No coração do cartão. Ela sobe pra prateleira ❤️ Favoritas, no topo, e sai da grade pra não repetir. Pra desfavoritar, é o coração dela lá em cima.",
      },
      {
        q: "Como monto uma playlist?",
        a: "No + do cartão. Se você ainda não tem nenhuma playlist, ele cria a primeira; se já tem, você escolhe em qual a música entra.",
      },
      {
        q: "Como acho uma música?",
        a: "Pela busca — nome, ocasião ou estilo — ou pelas pílulas logo abaixo dela. O Top 10 mostra as mais ouvidas do momento, e o resto da lista muda de ordem a cada visita.",
      },
      {
        q: "Posso mandar uma música pra alguém?",
        a: "Pode. Abra o player cheio e use link ou WhatsApp: quem receber abre sem precisar de conta. Nenhuma foto aparece nessa página — nem as suas, nem as de quem publicou.",
      },
    ],
  },

  carreira: {
    titulo: "Dúvidas sobre a sua carreira",
    itens: [
      {
        q: "Como ganho discos?",
        a: "Comprando música e indicando amigos. Na indicação, o disco entra quando o amigo compra — não no clique no link.",
      },
      {
        q: "Pra que serve subir de nível?",
        a: "A barra no topo mostra quanto falta. Cada nível novo aumenta o desconto nas suas próximas músicas, e o seu personagem muda junto.",
      },
      {
        q: "Meu nome aparece nas músicas que publico?",
        a: "Só se você quiser: preencha o apelido e ligue “Mostrar meu apelido na Rede”, que vem desligada. É uma escolha separada de autorizar a publicação da música.",
      },
      {
        q: "Como funcionam os lembretes de datas?",
        a: "Cadastre aniversários e datas importantes aqui nesta aba, e a gente te avisa com antecedência pra dar tempo de preparar a música.",
      },
    ],
  },
}

export default function AjudaCliente({ aba }: { aba: AbaAjuda }) {
  const { titulo, itens } = POR_ABA[aba]

  // UM clique abre a lista INTEIRA — não é sanfona por pergunta.
  //
  // As duas coisas que o formato precisa resolver puxavam em direções
  // opostas: quem tem dúvida não devia clicar sete vezes pra descobrir qual
  // resposta é a dele; e quem não tem dúvida nenhuma não devia rolar meia
  // tela de respostas até o fim da página. Um interruptor só para o bloco
  // atende os dois.
  //
  // Fechado por padrão, com a CONTAGEM no cabeçalho: ajuda escondida é ajuda
  // que ninguém encontra, e o número é o que denuncia que há conteúdo ali.
  const [aberto, setAberto] = useState(false)

  return (
    <div className="mt-10 border-t border-white/10 pt-8">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="w-full flex items-center gap-3 text-left group"
      >
        <span className="text-lg shrink-0">💡</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-semibold text-white group-hover:text-fuchsia-200 transition-colors">{titulo}</span>
          <span className="block text-xs text-white/40">
            {aberto ? "O essencial desta tela, em uma linha cada." : `${itens.length} respostas rápidas`}
          </span>
        </span>
        <span
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center border border-white/15 text-white/50 group-hover:text-white group-hover:border-white/35 transition-all"
          style={{ transform: aberto ? "rotate(180deg)" : "none" }}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {!aberto ? null : (
      /* Duas colunas no desktop: aberta, a lista fica alta demais numa
         coluna só. `break-inside` impede que um item seja partido ao meio
         entre as colunas. */
      <div className="sm:columns-2 sm:gap-5 mt-4">
        {itens.map((item) => (
          <div
            key={item.q}
            className="mb-2.5 break-inside-avoid rounded-2xl px-4 py-3 border border-white/[0.07] bg-white/[0.03]"
          >
            <p className="font-semibold text-white text-sm leading-snug">{item.q}</p>
            <p className="text-[13px] text-white/55 leading-relaxed mt-1">{item.a}</p>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}
