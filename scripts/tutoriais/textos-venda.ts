// Os textos das três locuções de venda, num lugar só.
//
// Vivem separados porque DOIS geradores os consomem: o de voz boa (Gemini) e
// o rascunho com a voz do sistema. Duplicar o texto faria os dois divergirem
// sem ninguém perceber — e aí o rascunho aprovado não seria o que vai ao ar.
//
// O que cada peça diz foi conferido contra o banco em 05/11/2026:
//
//   Essencial    R$  9,90   0 fotos   sem QR   sem ajustes
//   Pacote 10    R$ 49,90   0 fotos   sem QR   sem ajustes
//   Retrospect.  R$ 69,90  15 fotos   SEM QR   SEM ajustes
//   Premium      R$ 99,90  25 fotos   com QR   com ajustes
//
// Por isso o QR Code e os ajustes são atribuídos à PREMIUM, nunca à
// Retrospectiva em geral.

export type Peca = { arquivo: string; titulo: string; texto: string }

export const PECAS: Peca[] = [
  {
    arquivo: "01-produtos.mp3",
    titulo: "Os produtos e a diferença entre eles",
    texto:
      "Na Fiz Música, uma história vira música de verdade. E existem dois caminhos. " +
      "Se é pra presentear alguém, as Retrospectivas: a música sai junto com as fotos de vocês, " +
      "sincronizadas, e vira uma experiência pra pessoa assistir e guardar. " +
      "Se é pra você, a música avulsa: a sua história, a sua letra, a voz que você escolher. " +
      "E serve pra qualquer momento. Aniversário de namoro. Casamento. " +
      "Anunciar uma gravidez cantando, em vez de contar. Homenagear os avós. " +
      "Ou a sua composição autoral, aquela que até hoje só existiu na sua cabeça. " +
      "E tem mais: depois de pronta, você pode publicar a sua música no SpotFiz, de graça, " +
      "e deixar todo mundo ouvir o que você criou.",
  },
  {
    arquivo: "02-retrospectiva.mp3",
    titulo: "A Retrospectiva por dentro",
    texto:
      "A Retrospectiva é a música com as fotos de vocês dentro dela. Funciona assim. " +
      "Você conta a história e a letra é escrita com você. Antes de qualquer coisa ser gravada, " +
      "você lê, ajusta, troca uma palavra, aprova. A letra é sua. " +
      "Depois a música chega em duas versões. Você ouve as duas com calma e escolhe a que te emocionou. " +
      "Aí você envia as fotos. Elas aparecem passando no ritmo da música, na ordem que você montar, " +
      "com a letra acompanhando na tela. " +
      "E a entrega é um link exclusivo, feito pra pessoa homenageada. " +
      "Ela abre no celular e vê tudo: a capa, as fotos, a música tocando. " +
      "Na versão Premium você ainda leva um cartão com QR Code pra entregar na mão. " +
      "A pessoa aponta a câmera e a música começa ali, na frente de todo mundo. " +
      "E a Premium também inclui ajustes, se depois de ouvir você quiser mudar alguma coisa.",
  },
  {
    arquivo: "03-como-criar.mp3",
    titulo: "Como criar a sua música",
    texto:
      "Criar a sua música leva poucos minutos, e é mais simples do que parece. " +
      "Primeiro você escolhe a ocasião. Um pedido de namoro, o aniversário da sua mãe, " +
      "uma homenagem ao seu pet, ou uma composição sua, do zero. " +
      "Depois a gente faz algumas perguntas sobre a história. Como vocês se conheceram. " +
      "Aquela mania que só ela tem. O que não pode faltar na letra. " +
      "Você digita, ou aperta o microfone e fala — do jeito que for mais fácil. " +
      "Então você escolhe o estilo: sertanejo, pagode, gospel, rock, o que combinar com a pessoa. " +
      "A voz, masculina ou feminina. E a emoção que a música tem que ter. " +
      "E aqui vem a melhor parte: antes de pagar qualquer coisa, " +
      "você já lê o refrão da sua música, escrito ali, com a sua história dentro. " +
      "Gostou? Aprova a letra e, em minutos, a música está pronta pra você ouvir. " +
      "A sua história merece virar música. Começa agora.",
  },
]

