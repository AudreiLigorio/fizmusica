// Landings por tema. Quem vê um Reel sobre homenagem à mãe deve cair numa
// página sobre isso — não na home genérica, que faz a pessoa recomeçar o
// raciocínio do zero. Os temas espelham as ocasiões reais do wizard.

export type Tema = {
  slug: string
  titulo: string
  h1: string
  sub: string
  bullets: string[]
  cta: string
  /** Palavras que, aparecendo no tema/subcategoria do rascunho, apontam pra cá. */
  gatilhos: string[]
}

export const TEMAS: Tema[] = [
  {
    slug: "mae",
    titulo: "Música personalizada para mãe",
    h1: "Uma música que diz o que você nunca conseguiu dizer",
    sub: "A história de vocês duas virando canção — com o nome dela, as manias dela, o que só vocês sabem.",
    bullets: [
      "Feita a partir da sua história, não de um modelo pronto",
      "Com o nome dela e os detalhes que ninguém mais conhece",
      "Pronta para o dia em que você quiser entregar",
    ],
    cta: "Contar a história da minha mãe",
    gatilhos: ["mãe", "mae", "materna", "dia das mães"],
  },
  {
    slug: "pai",
    titulo: "Música personalizada para pai",
    h1: "Ele nunca foi de falar. A música fala por vocês dois",
    sub: "Aquela história de pai e filho que rende risada e silêncio na mesma frase — transformada em canção.",
    bullets: [
      "A história de vocês, do jeito que só vocês viveram",
      "Com o nome dele e os detalhes que fazem rir e emocionar",
      "Um presente que ele não vai saber onde guardar — porque não cabe numa gaveta",
    ],
    cta: "Contar a história do meu pai",
    gatilhos: ["pai", "paterno", "dia dos pais"],
  },
  {
    slug: "casamento",
    titulo: "Música para pedido de casamento e bodas",
    h1: "O momento que ela vai contar pelo resto da vida",
    sub: "Uma música feita só para vocês, tocando na hora exata do pedido — ou do brinde de bodas.",
    bullets: [
      "A história de vocês, do primeiro encontro ao pedido",
      "Pronta para tocar no momento certo, sem improviso",
      "Os convidados ouvem e entendem tudo sem você explicar nada",
    ],
    cta: "Contar a nossa história",
    gatilhos: ["casamento", "noiv", "bodas", "pedido", "namoro", "namorados"],
  },
  {
    slug: "revelacao",
    titulo: "Música para chá revelação",
    h1: "A revelação que ninguém no chá vai esquecer",
    sub: "Em vez do balão de sempre, a notícia chega cantada — com o nome de vocês na letra.",
    bullets: [
      "A espera, o susto e a alegria na ordem certa",
      "O vídeo do momento fica bom sozinho, sem edição",
      "Serve para contar ao pai, à família ou no chá inteiro",
    ],
    cta: "Preparar a nossa revelação",
    gatilhos: ["revelação", "revelacao", "chá revelação", "grávida", "gravidez", "bebê", "bebe"],
  },
  {
    slug: "pet",
    titulo: "Homenagem em música para o seu pet",
    h1: "Para que ele nunca seja só uma lembrança",
    sub: "A história do seu companheiro virando música — as manias, o nome, o jeito de esperar na porta.",
    bullets: [
      "A história dele, contada com o cuidado que ele merece",
      "Serve para homenagear quem está aqui ou para despedida",
      "Feita no seu tempo, sem pressa nenhuma",
    ],
    cta: "Contar a história dele",
    gatilhos: ["pet", "cachorro", "gato", "cão", "animal"],
  },
  {
    slug: "homenagem",
    titulo: "Música personalizada de homenagem",
    h1: "Tem gente que merece mais que um presente comum",
    sub: "Avós, filhos, amigos, professores, quem se aposenta, quem se forma. A história vira música com nome e sobrenome.",
    bullets: [
      "Feita a partir da história real de quem você quer homenagear",
      "Emociona na hora e continua emocionando depois",
      "Funciona para entrega individual ou homenagem coletiva",
    ],
    cta: "Contar essa história",
    gatilhos: ["homenagem", "avó", "avô", "filho", "amigo", "professor", "aposentadoria", "formando", "empresa", "time"],
  },
]

export function getTema(slug: string): Tema | undefined {
  return TEMAS.find((t) => t.slug === slug)
}

// Escolhe a landing a partir do texto do rascunho (tema livre ou subcategoria
// do pedido). Sem correspondência, devolve null — o link cai no /criar.
export function temaFromTexto(texto: string | null | undefined): string | null {
  if (!texto) return null
  const t = texto.toLowerCase()
  for (const tema of TEMAS) {
    if (tema.gatilhos.some((g) => t.includes(g))) return tema.slug
  }
  return null
}
