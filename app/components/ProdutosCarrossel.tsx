"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { track } from "@/lib/track"

// Vitrine de produtos com preço, logo antes dos exemplos em vídeo.
//
// Os produtos vêm da API (/api/produtos), NUNCA de uma lista escrita aqui.
// Preço na home é promessa de venda: se ficar fixo no código, uma alteração
// no admin muda o checkout e deixa a home anunciando o valor antigo — o
// projeto já teve o bug de "preço mostrado ≠ preço cobrado" e ele custou
// caro. Mesmo motivo pro nome, pras fotos e pros recursos de cada plano.

type Produto = {
  id: string
  name: string
  price: number
  photo_limit?: number | null
  feat_lyrics_sync?: boolean | null
  feat_qrcode?: boolean | null
  feat_revision?: boolean | null
  featured?: boolean
  // Migração 071. Decidem em QUAL bloco a carta entra e o que o clique faz.
  credits_granted?: number | null
  credit_price?: number | null
}

// Paleta por posição: branco, laranja, azul, verde, magenta. Fica fora do
// banco de propósito — é decisão visual desta tela, não atributo do produto.
//
// A primeira era roxa e virou BRANCA a pedido do Audrei: o botão "Começar
// agora" da carta gratuita, logo à esquerda, também é roxo, e as duas
// apareciam coladas repetindo a mesma cor.
//
// São 5 porque hoje existem 5 planos: com 4 o quinto voltava pro índice 0 e
// repetia a cor do primeiro — que é justamente o que se quer evitar. Se
// entrar um 6º, ele reaproveita a primeira em vez de ficar sem cor.
//
// `precoTexto` existe por causa do branco: a etiqueta de preço pinta o texto
// SOBRE `forte`, e branco no branco desapareceria.
const CORES = [
  // Cor "neutra" do primeiro plano: branco no tema escuro, grafite no claro
  // (com branco ele sumia no fundo claro — ícone, ✓ e pílula de preço). Vem
  // de variáveis CSS definidas em globals.css, que trocam com o tema.
  { forte: "var(--vitrine-neutra-forte)", suave: "var(--vitrine-neutra-suave)", borda: "var(--vitrine-neutra-borda)", precoTexto: "var(--vitrine-neutra-preco-texto)" },
  { forte: "#f59e0b", suave: "rgba(245,158,11,0.18)", borda: "rgba(245,158,11,0.35)", precoTexto: "#ffffff" },
  { forte: "#3b82f6", suave: "rgba(59,130,246,0.18)", borda: "rgba(59,130,246,0.35)", precoTexto: "#ffffff" },
  { forte: "#22c55e", suave: "rgba(34,197,94,0.18)", borda: "rgba(34,197,94,0.35)", precoTexto: "#ffffff" },
  { forte: "#d946ef", suave: "rgba(217,70,239,0.18)", borda: "rgba(217,70,239,0.35)", precoTexto: "#ffffff" },
]

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

// Ícone escolhido pelo que o plano ENTREGA, não pela posição na lista: quem
// tem QR Code ganha o presente, quem tem foto ganha a imagem, e assim por
// diante. Assim a vitrine continua coerente se a ordem dos planos mudar.
function iconeDoPlano(p: Produto) {
  if (p.feat_qrcode) {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true" {...S}>
        <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" />
        <line x1="12" y1="22" x2="12" y2="7" />
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </svg>
    )
  }
  if ((p.photo_limit ?? 0) > 0) {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true" {...S}>
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true" {...S}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}

// Em qual porta este produto mora.
//
// A divisão é por FOTO, não por preço nem por nome: presente é o que vem com
// retrospectiva e cartão para entregar; "para você" é a música sozinha, que
// vai pro SpotFiz. Isso já classifica o catálogo de hoje corretamente
// (Essencial sem foto, Retrospectiva com 15, Premium com 25) e continua
// valendo quando o pacote pré-pago entrar — ele também não tem foto.
//
// Por que separar: R$ 49,90 por dez músicas ao lado de R$ 69,90 por uma
// retrospectiva convida à comparação errada entre coisas que não competem.
// Dentro de cada bloco tudo é comparável; entre blocos, nada deveria estar
// lado a lado.
function ehPresente(p: Produto): boolean {
  return (p.photo_limit ?? 0) > 0
}

function ehPacote(p: Produto): boolean {
  return (p.credits_granted ?? 0) > 0
}

// Itens que TODO plano entrega. Ficam no código porque não existem como
// campo no banco — não há coluna de "capa" nem de "2ª versão", e inventar
// uma só pra marcar `true` em todos os planos seria dado morto.
const BENEFICIOS_DE_TODOS = ["Música personalizada", "Capa exclusiva", "Segunda versão grátis"]
const BENEFICIOS_FINAIS   = ["Publicar no SpotFiz", "Criar playlist"]

// O que vem no plano, na ordem que o Audrei passou. Os itens do MEIO saem
// dos campos do produto (os mesmos que a /produtos usa pra montar os chips),
// nunca de lista fixa por nome: preso ao nome, mudar um plano no admin
// deixaria a home prometendo o que o checkout não entrega.
// O PACOTE tem lista própria, e precisa ter.
//
// Montada pelas flags do produto, ela saía idêntica à da música avulsa —
// seis itens iguais, e lado a lado o pacote lia como "a mesma coisa, cinco
// vezes mais caro". A lista por flags descreve UMA música; um pacote são
// dez, e isso não é uma flag.
//
// A última linha é a mais importante e é por ela que esta função existe:
// **diz na venda onde o crédito vale**. Sem ela a pessoa só descobre no
// checkout da Retrospectiva que o crédito não serve ali — tarde, e parecendo
// pegadinha.
//
// `avulsa` entra pra o desconto ser CALCULADO, não escrito à mão: escrito,
// ele vira mentira no dia em que qualquer um dos dois preços mudar.
function beneficiosDoPacote(p: Produto, avulsa: Produto | null): string[] {
  const n = p.credits_granted ?? 0
  const porMusica = p.price / n
  const itens = [
    `${n} músicas para criar quando quiser`,
    `R$ ${brl(porMusica)} cada`,
  ]
  if (avulsa && avulsa.price > porMusica) {
    const off = Math.round((1 - porMusica / avulsa.price) * 100)
    itens[1] = `R$ ${brl(porMusica)} cada — ${off}% menos que a avulsa`
  }
  itens.push("Cada uma com capa, letra sincronizada e SpotFiz")
  itens.push("Válido nas músicas avulsas")
  return itens
}

function beneficios(p: Produto): string[] {
  const meio: string[] = []
  if (p.feat_lyrics_sync) meio.push("Letra sincronizada")
  if ((p.photo_limit ?? 0) > 0) meio.push(`Retrospectiva com ${p.photo_limit} fotos sincronizadas`)
  if (p.feat_qrcode) meio.push("Cartão com QR Code para presentear")
  if (p.feat_revision) meio.push("Ajustes inclusos")
  return [...BENEFICIOS_DE_TODOS, ...meio, ...BENEFICIOS_FINAIS]
}

// O que ESTE plano traz que nenhum mais barato tinha — e é só isso que vai em
// negrito (pedido do Audrei, 2026-10-28). Com seis a nove linhas quase iguais
// em cada carta, a pessoa precisa comparar item a item pra achar o que muda;
// o negrito faz a diferença saltar sem ela ler tudo.
//
// A conta é contra a UNIÃO dos planos mais baratos, não contra o vizinho
// imediato: se um item some no meio e volta no topo, ele é novidade de novo
// em relação ao anterior, mas não é novidade nenhuma pra quem olha a escada
// inteira.
//
// Não dá pra marcar simplesmente os itens do `meio`: "Letra sincronizada" sai
// de lá e está em TODOS os planos pagos — ficaria em negrito nos três sem
// diferenciar nada. Por isso a comparação é por preço, não por origem.
function novidadesPorPlano(ordenadosPorPreco: Produto[]): Record<string, Set<string>> {
  const vistos = new Set<string>()
  const saida: Record<string, Set<string>> = {}
  for (const p of ordenadosPorPreco) {
    const meus = beneficios(p)
    saida[p.id] = new Set(meus.filter((b) => !vistos.has(b)))
    for (const b of meus) vistos.add(b)
  }
  // O plano mais barato não ganha negrito: tudo nele seria "novidade", e uma
  // carta inteira em negrito não destaca nada. Ele é a linha de base.
  const primeiro = ordenadosPorPreco[0]
  if (primeiro) saida[primeiro.id] = new Set()
  return saida
}

const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ProdutosCarrossel() {
  const router = useRouter()
  const [produtos, setProdutos] = useState<Produto[] | null>(null)

  // Calculado uma vez pra lista inteira: cada carta precisa saber o que os
  // planos mais baratos JÁ tinham, e isso é informação da escada, não da carta.
  const novidades = novidadesPorPlano(produtos ?? [])

  useEffect(() => {
    fetch("/api/produtos")
      .then((r) => r.json())
      // Ordena por PREÇO, do menor pro maior (pedido do Audrei). A API
      // devolve na ordem da loja — destaque primeiro, depois `sortOrder` —
      // que aqui jogava o plano de R$ 89,90 na frente do de R$ 15,90.
      // Ordenar aqui, e não na API, porque /produtos e /admin dependem
      // daquela ordem; esta é uma escolha de vitrine, não do catálogo.
      .then((d) => setProdutos([...(d.products ?? [])].sort((a, b) => a.price - b.price)))
      .catch(() => setProdutos([]))
  }, [])

  const precos = (produtos ?? []).map((p) => p.price)
  const menor = precos.length ? Math.min(...precos) : null
  const maior = precos.length ? Math.max(...precos) : null

  // A avulsa de referência: o produto que aceita crédito. É contra ela que o
  // pacote mostra o desconto — e achá-la por `credit_price` em vez de por
  // nome ou preço mantém a conta certa se o catálogo mudar.
  const avulsa = (produtos ?? []).find((p) => !ehPacote(p) && (p.credit_price ?? 0) > 0) ?? null

  // Dois blocos. A ordem é deliberada: presente primeiro, porque é o produto
  // principal e o de maior valor, e é dele que o topo da página já fala.
  const presentes = (produtos ?? []).filter(ehPresente)
  const paraVoce  = (produtos ?? []).filter((p) => !ehPresente(p))

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Cabeçalho ─────────────────────────────────────────── */}
      <div className="mb-7 lg:mb-9">
        <h2 className="font-extrabold uppercase leading-[0.98] tracking-tight"
            style={{ fontSize: "clamp(1.6rem, 4.4vw, 2.6rem)" }}>
          <span className="block text-white">Músicas que contam</span>
          <span className="block" style={{ background: "linear-gradient(90deg,#f0196b,#d946ef)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            histórias inesquecíveis
          </span>
        </h2>
        <p className="text-sm text-white/60 mt-3">
          Escolha o produto ideal para cada momento e transforme emoção em música.
        </p>
      </div>

      {/* ── Bloco 1: PRESENTE ──────────────────────────────────
          Rosa, o mesmo tom do "Quero homenagear alguém" do wizard. A cor é
          fio condutor: a pessoa clica na carta rosa aqui e cai na porta rosa
          lá, sem nenhuma tela precisar explicar nada. */}
      <TituloDoBloco
        emoji="💝"
        titulo="Para presentear"
        cor="#f0196b"
        descricao="Com as fotos e o cartão para entregar"
      />
      <Trilho>
        {produtos === null
          ? [0, 1, 2].map((i) => <CartaEsqueleto key={i} />)
          : presentes.map((p, i) => (
              <CartaProduto
                key={p.id}
                produto={p}
                cor={CORES[i % CORES.length]}
                novidades={novidades[p.id] ?? new Set()}
                itens={beneficios(p)}
                // Leva pro WIZARD levando o plano escolhido, não direto
                // pra /produtos. O pedido nasce no fim do wizard e todo o
                // resto depende do `orderId` dele: caindo em /produtos sem
                // pedido, a tela abria normal e o botão "Ir para pagamento"
                // ficava ATIVO sem fazer nada ao clicar — beco sem saída
                // silencioso justo no botão de compra.
                onClick={() => { track("cta_produto", "carrossel_produtos"); router.push(`/criar?produto=${encodeURIComponent(p.id)}`) }}
              />
            ))}
      </Trilho>

      {/* ── Bloco 2: PARA VOCÊ ─────────────────────────────────
          Âmbar, o mesmo do "Quero fazer música". Aqui a comparação é
          saudável: é a mesma coisa em duas quantidades, e o preço por música
          faz o trabalho de venda sem precisar de explicação. */}
      {/* Só depois de os produtos chegarem.
          Enquanto carregava, este bloco mostrava apenas o cartão grátis — e
          quando os produtos chegavam, o pago era inserido ANTES dele. O
          navegador então desloca a rolagem para manter o que estava visível
          no lugar (scroll anchoring), e o trilho abria já rolado até o fim,
          com a seta "anteriores" acesa. Nascer pronto evita isso sem
          precisar desligar a ancoragem. */}
      {produtos !== null && paraVoce.length > 0 && (
        <div className="mt-12 lg:mt-16">
          <TituloDoBloco
            emoji="🎧"
            titulo="Para você"
            cor="#f6b440"
            descricao="Sua música, publicada no SpotFiz"
          />
          <Trilho>
            {paraVoce.map((p, i) => (
              <CartaProduto
                key={p.id}
                produto={p}
                cor={CORES[(i + 1) % CORES.length]}
                novidades={ehPacote(p) ? new Set() : (novidades[p.id] ?? new Set())}
                itens={ehPacote(p) ? beneficiosDoPacote(p, avulsa) : beneficios(p)}
                precoPorMusica={ehPacote(p) ? `R$ ${brl(p.price / (p.credits_granted ?? 1))} por música` : null}
                onClick={() => {
                  track("cta_produto", "carrossel_produtos")
                  // O PACOTE entra no wizard igual a qualquer plano.
                  //
                  // Antes ele tinha caminho próprio e empurrava quem não
                  // estava logado direto pro login — parede na cara de quem
                  // só queria comprar, antes de a pessoa ter feito nada. E a
                  // conta continua sendo necessária (o crédito vive no
                  // usuário), só que agora ela é pedida na hora de pagar, que
                  // é quando pedir login é normal.
                  //
                  // Quem segue por aqui faz a primeira música e, ao fechar o
                  // pacote, 1 dos 10 créditos paga ela na hora
                  // (honrarPedidoVinculadoAoPacote). Sai com a música
                  // encomendada e 9 créditos.
                  router.push(`/criar?produto=${encodeURIComponent(p.id)}`)
                }}
              />
            ))}
            <CartaRede onClick={() => { track("cta_rede", "carrossel_produtos"); router.push("/minha-musica?aba=musicas") }} />
          </Trilho>
        </div>
      )}

      {/* Faixa de preço + CTA final. Pedido do Audrei: sair do cabeçalho
          (onde disputava atenção com o título antes de a pessoa ver os
          planos) e virar o fechamento — depois de ver os preços reais e
          comparar os planos é que faz sentido pedir a decisão. */}
      <div className="flex flex-col items-center gap-3 mt-9 lg:mt-11 text-center">
        {/* Faixa calculada dos produtos REAIS. Escrita à mão ela viraria
            mentira no dia em que um plano mudasse de valor. */}
        {menor !== null && maior !== null && (
          <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/15 bg-white/[0.04]">
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" style={{ color: "#ff3d84" }} {...S}>
              <path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.3" />
            </svg>
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/50 leading-tight">
              Produtos transparentes
              <span className="block text-sm tracking-normal normal-case text-white/90 font-semibold">
                de R$ {brl(menor)} a R$ {brl(maior)}
              </span>
            </span>
          </div>
        )}

        <button
          onClick={() => { track("cta_criar", "carrossel_produtos"); router.push("/criar") }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.97]"
          style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)", boxShadow: "0 8px 26px rgba(240,25,107,0.35)" }}
        >
          Crie agora sua trilha sonora!
          <svg viewBox="0 0 24 24" className="w-4 h-4" {...S} strokeWidth={2.2}><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  )
}

function SetaRolagem({ lado, onClick }: { lado: "esq" | "dir"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={lado === "esq" ? "Ver produtos anteriores" : "Ver mais produtos"}
      className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full items-center justify-center border border-white/15 bg-[#0d0b16]/90 text-white/70 hover:text-white hover:border-white/35 transition-colors ${lado === "esq" ? "-left-5" : "-right-5"}`}
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d={lado === "esq" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
      </svg>
    </button>
  )
}

// Largura das cartas: enxutas (pedido do Audrei). No celular 66% da tela,
// deixando um pedaço da seguinte aparecer — é o que avisa que dá pra
// arrastar. No desktop dividem a linha por igual, mas com PISO de 200px:
// sem ele, cada plano novo espremia todos os outros (com 6 cartas dariam
// ~180px e nomes longos viravam quatro linhas). Batendo no piso o trilho
// passa a rolar e as setas aparecem — que é o comportamento de carrossel
// esperado, em vez de cartas ilegíveis.
const LARGURA = "snap-start shrink-0 w-[66vw] sm:w-[240px] lg:w-auto lg:flex-1 lg:basis-0 lg:min-w-[200px]"

// Cabeçalho de cada porta. O emoji e a cor são os MESMOS do primeiro passo
// do wizard (🎧 âmbar "Quero fazer música", 💝 rosa "Quero homenagear"), de
// propósito: a continuidade visual explica a divisão sem nenhuma tela ter
// que ensinar.
function TituloDoBloco({ emoji, titulo, cor, descricao }: {
  emoji: string; titulo: string; cor: string; descricao: string
}) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-bold flex items-center gap-2">
        <span aria-hidden="true">{emoji}</span>
        <span style={{ color: cor }}>{titulo}</span>
      </h3>
      <p className="text-[13px] text-white/50 mt-0.5">{descricao}</p>
    </div>
  )
}

// Trilho de rolagem com as próprias setas. Virou componente quando a vitrine
// passou a ter DOIS blocos: cada um precisa do seu ref e do seu estado de
// "tem mais pra lá", e compartilhar um só faria as setas de um bloco medirem
// o outro.
function Trilho({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [antes, setAntes] = useState(false)
  const [depois, setDepois] = useState(false)

  function medir() {
    const el = ref.current
    if (!el) return
    const folga = 4 // arredondamento do navegador
    setAntes(el.scrollLeft > folga)
    setDepois(el.scrollLeft + el.clientWidth < el.scrollWidth - folga)
  }

  useEffect(() => {
    medir()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [children])

  function rolar(dir: -1 | 1) {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" })
  }

  return (
    <div className="relative">
      {antes && <SetaRolagem lado="esq" onClick={() => rolar(-1)} />}
      {depois && <SetaRolagem lado="dir" onClick={() => rolar(1)} />}
      <div
        ref={ref}
        onScroll={medir}
        // `scroll-pl-6` casando com o `px-6`: sem ele o snap come a sangria
        // esquerda e o trilho trava em scrollLeft 24 em vez de 0 — a seta
        // "anteriores" aparece sem ter nada antes. É o mesmo defeito que já
        // apareceu na raia "Mais recentes" do SpotFiz, mesma causa.
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-6 px-6 scroll-pl-6 lg:mx-0 lg:px-0 lg:scroll-pl-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  )
}

function CartaRede({ onClick }: { onClick: () => void }) {
  const itens = [
    { texto: "Você cria sua playlist", cor: "#a855f7", icon: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></> },
    { texto: "Ouça as músicas que os usuários disponibilizaram", cor: "#f0196b", icon: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8Z" /> },
    { texto: "Músicas exclusivas feitas por histórias reais", cor: "#3b82f6", icon: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2l-5-4.9 6.9-1Z" /> },
  ]

  return (
    // A grátis vem por ÚLTIMO, e agora por posição no DOM em vez de
    // `order-last`. A razão de ela não vir na frente continua a mesma: no
    // celular cabe uma carta por vez, e abrir a vitrine com "Começar agora"
    // (que não é compra) empurrava o plano pago para três arrastadas depois.
    //
    // O que mudou foi COMO: com `order-last` o cartão era o primeiro do DOM e
    // o último na tela, e o navegador ancora a rolagem inicial no primeiro
    // elemento do DOM — o trilho abria já rolado até o fim.
    // e o navegador ancora a rolagem inicial no primeiro elemento do DOM —
    // o trilho abria já rolado até o fim. Agora ele é o último nos dois, e a
    // ordem fica: o que se compra primeiro, a alternativa grátis depois.
    <div className={`${LARGURA} rounded-2xl border border-white/10 bg-white/[0.04] p-5 flex flex-col`}>
      <span className="self-start px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-300 border border-emerald-400/30 bg-emerald-400/10">
        Gratuito
      </span>

      <h3 className="mt-4 text-lg font-bold leading-tight text-white">
        {/* "no SpotFiz", não "na rede Fiz Música": a renomeação de outubro
            passou pela aba, pela home, pelo FAQ e pelos termos, e este card
            ficou pra trás. O resto do app já diz "no SpotFiz" sem "rede" —
            seguir o mesmo nome evita que a pessoa ache que são dois lugares. */}
        Ouvir música<br />no <span style={{ color: "#ff3d84" }}>SpotFiz</span>
      </h3>

      <ul className="mt-4 space-y-3 grow">
        {itens.map((it) => (
          <li key={it.texto} className="flex items-start gap-2.5 text-sm text-white/70 leading-snug">
            <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center border"
                  style={{ color: it.cor, borderColor: `${it.cor}55`, background: `${it.cor}1f` }}>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" {...S}>{it.icon}</svg>
            </span>
            {it.texto}
          </li>
        ))}
      </ul>

      {/* Botão roxo (pedido do Audrei) — o selo "Gratuito" continua verde,
          que é o que carrega a informação de preço; o roxo aqui puxa a
          carta pra paleta da marca em vez de deixá-la verde inteira. */}
      <button
        onClick={onClick}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
        style={{ background: "linear-gradient(135deg,#8b5cf6,#a855f7)", boxShadow: "0 6px 20px rgba(139,92,246,0.35)" }}
      >
        Começar agora
        <svg viewBox="0 0 24 24" className="w-4 h-4" {...S} strokeWidth={2.2}><path d="m9 6 6 6-6 6" /></svg>
      </button>
    </div>
  )
}

function CartaProduto({ produto, cor, novidades, itens, precoPorMusica, onClick }: {
  produto: Produto
  cor: (typeof CORES)[number]
  // O que só existe a partir deste plano — vai em negrito (ver `novidadesPorPlano`).
  novidades: Set<string>
  // Vem de fora porque o pacote precisa comparar com a avulsa, e a carta não
  // conhece o catálogo.
  itens: string[]
  // Só no pacote: a linha pequena embaixo do preço cheio.
  precoPorMusica?: string | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`${LARGURA} text-left rounded-2xl border bg-white/[0.04] p-5 flex flex-col transition-all hover:-translate-y-1 hover:bg-white/[0.07]`}
      style={{ borderColor: cor.borda }}
    >
      {/* Altura reservada mesmo sem selo, senão a carta em destaque empurra
          o título pra baixo e as cartas ficam desalinhadas entre si. */}
      <div className="h-6">
        {produto.featured && (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.12em]"
                style={{ color: cor.forte, background: cor.suave, border: `1px solid ${cor.borda}` }}>
            Mais escolhido
          </span>
        )}
      </div>

      <span className="mt-3 w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ color: cor.forte, background: cor.suave, border: `1px solid ${cor.borda}` }}>
        {iconeDoPlano(produto)}
      </span>

      <h3 className="mt-4 text-lg font-bold leading-tight" style={{ color: cor.forte }}>
        {produto.name}
      </h3>

      {/* Lista de benefícios (pedido do Audrei), no lugar da linha única
          "Música + X + Y". `grow` empurra o preço pro rodapé: as cartas
          esticam todas na altura da mais longa, então sem isso o preço de
          cada uma pararia numa altura diferente. */}
      <ul className="mt-3 space-y-1.5 grow">
        {itens.map((b) => {
          const novo = novidades.has(b)
          return (
            // `items-start` + `shrink-0`: nesta largura os itens longos quebram
            // em duas linhas, e sem isso o check escorregaria pro meio do texto.
            <li key={b} className={`flex items-start gap-1.5 text-[13px] leading-snug ${
              // Novidade ganha peso E contraste. Só engrossar a fonte quase não
              // aparece em texto de 13px; o que faz a linha saltar é a soma dos
              // dois, e é por isso que a cor sobe junto.
              novo ? "font-bold text-white/95" : "text-white/65"
            }`}>
              <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0 mt-[3px]" aria-hidden="true"
                   fill="none" style={{ stroke: cor.forte }} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 5 5L20 7" />
              </svg>
              {b}
            </li>
          )
        })}
      </ul>

      <div className="mt-4 self-start">
        <span className="inline-block px-4 py-2 rounded-xl text-base font-extrabold"
              style={{ background: cor.forte, color: cor.precoTexto }}>
          R$ {brl(produto.price)}
        </span>
        {/* O preço por música embaixo do preço cheio: é ele que faz a
            comparação com a avulsa acontecer sem texto explicando. */}
        {precoPorMusica && (
          <span className="block text-[13px] text-white/50 mt-1.5">{precoPorMusica}</span>
        )}
      </div>
    </button>
  )
}

// Esqueleto com a MESMA altura da carta real: sem isso a seção encolhe e
// depois estica quando a API responde, empurrando o resto da página.
function CartaEsqueleto() {
  return (
    <div className={`${LARGURA} rounded-2xl border border-white/10 bg-white/[0.03] p-5 animate-pulse`}>
      <div className="h-6" />
      <div className="mt-3 w-14 h-14 rounded-2xl bg-white/10" />
      <div className="mt-4 h-5 w-2/3 rounded bg-white/10" />
      <div className="mt-3 h-3 w-full rounded bg-white/[0.07]" />
      <div className="mt-2 h-3 w-4/5 rounded bg-white/[0.07]" />
      <div className="mt-4 h-9 w-28 rounded-xl bg-white/10" />
    </div>
  )
}
