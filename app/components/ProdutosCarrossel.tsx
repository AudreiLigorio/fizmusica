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
  { forte: "#ffffff", suave: "rgba(255,255,255,0.10)", borda: "rgba(255,255,255,0.28)", precoTexto: "#0d0b16" },
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

// Itens que TODO plano entrega. Ficam no código porque não existem como
// campo no banco — não há coluna de "capa" nem de "2ª versão", e inventar
// uma só pra marcar `true` em todos os planos seria dado morto.
const BENEFICIOS_DE_TODOS = ["Música personalizada", "Capa exclusiva", "Segunda versão grátis"]
const BENEFICIOS_FINAIS   = ["Publicar na Rede Fiz Música", "Criar playlist"]

// O que vem no plano, na ordem que o Audrei passou. Os itens do MEIO saem
// dos campos do produto (os mesmos que a /produtos usa pra montar os chips),
// nunca de lista fixa por nome: preso ao nome, mudar um plano no admin
// deixaria a home prometendo o que o checkout não entrega.
function beneficios(p: Produto): string[] {
  const meio: string[] = []
  if (p.feat_lyrics_sync) meio.push("Letra sincronizada")
  if ((p.photo_limit ?? 0) > 0) meio.push(`Retrospectiva com ${p.photo_limit} fotos sincronizadas`)
  if (p.feat_qrcode) meio.push("Cartão com QR Code para presentear")
  if (p.feat_revision) meio.push("Ajustes inclusos")
  return [...BENEFICIOS_DE_TODOS, ...meio, ...BENEFICIOS_FINAIS]
}

const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ProdutosCarrossel() {
  const router = useRouter()
  const [produtos, setProdutos] = useState<Produto[] | null>(null)
  const trilhoRef = useRef<HTMLDivElement>(null)
  const [temAntes, setTemAntes] = useState(false)
  const [temDepois, setTemDepois] = useState(false)

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

  // As setas só existem quando há o que rolar. Seta que não leva a lugar
  // nenhum é pior que seta nenhuma: promete conteúdo e não entrega.
  function medirRolagem() {
    const el = trilhoRef.current
    if (!el) return
    setTemAntes(el.scrollLeft > 8)
    setTemDepois(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }

  useEffect(() => {
    medirRolagem()
    const el = trilhoRef.current
    if (!el) return
    // `resize` no window não cobre tudo: as cartas mudam de largura quando as
    // fontes carregam e quando os produtos chegam da API, sem a janela mexer.
    const ro = new ResizeObserver(medirRolagem)
    ro.observe(el)
    return () => ro.disconnect()
  }, [produtos])

  function rolar(dir: -1 | 1) {
    const el = trilhoRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" })
  }

  const precos = (produtos ?? []).map((p) => p.price)
  const menor = precos.length ? Math.min(...precos) : null
  const maior = precos.length ? Math.max(...precos) : null

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

      {/* ── Carrossel ─────────────────────────────────────────── */}
      <div className="relative">
        {/* Setas só no desktop: no celular a rolagem com o dedo já é o gesto
            natural, e botão sobreposto ali só cobriria a carta. */}
        {temAntes && (
          <SetaRolagem lado="esq" onClick={() => rolar(-1)} />
        )}
        {temDepois && (
          <SetaRolagem lado="dir" onClick={() => rolar(1)} />
        )}

        <div
          ref={trilhoRef}
          onScroll={medirRolagem}
          // `snap-x` pra carta nunca parar cortada no meio. A sangria
          // (-mx-6 + px-6) faz a rolagem começar e terminar rente à borda da
          // tela no celular, em vez de parecer cortada dentro do padding.
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-6 px-6 lg:mx-0 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <CartaRede onClick={() => { track("cta_rede", "carrossel_produtos"); router.push("/minha-musica?aba=musicas") }} />

          {produtos === null
            ? [0, 1, 2].map((i) => <CartaEsqueleto key={i} />)
            : produtos.map((p, i) => (
                <CartaProduto
                  key={p.id}
                  produto={p}
                  cor={CORES[i % CORES.length]}
                  // Leva pro WIZARD levando o plano escolhido, não direto
                  // pra /produtos. O pedido nasce no fim do wizard e todo o
                  // resto depende do `orderId` dele: caindo em /produtos sem
                  // pedido, a tela abria normal e o botão "Ir para pagamento"
                  // ficava ATIVO sem fazer nada ao clicar — beco sem saída
                  // silencioso justo no botão de compra.
                  onClick={() => { track("cta_produto", "carrossel_produtos"); router.push(`/criar?produto=${encodeURIComponent(p.id)}`) }}
                />
              ))}
        </div>
      </div>

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

function CartaRede({ onClick }: { onClick: () => void }) {
  const itens = [
    { texto: "Você cria sua playlist", cor: "#a855f7", icon: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></> },
    { texto: "Ouça as músicas que os usuários disponibilizaram", cor: "#f0196b", icon: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8Z" /> },
    { texto: "Músicas exclusivas feitas por histórias reais", cor: "#3b82f6", icon: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2l-5-4.9 6.9-1Z" /> },
  ]

  return (
    <div className={`${LARGURA} rounded-2xl border border-white/10 bg-white/[0.04] p-5 flex flex-col`}>
      <span className="self-start px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300 border border-emerald-400/30 bg-emerald-400/10">
        Gratuito
      </span>

      <h3 className="mt-4 text-lg font-bold leading-tight text-white">
        Ouvir música<br />na rede <span style={{ color: "#ff3d84" }}>Fiz Música</span>
      </h3>

      <ul className="mt-4 space-y-3 grow">
        {itens.map((it) => (
          <li key={it.texto} className="flex items-start gap-2.5 text-xs text-white/70 leading-snug">
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

function CartaProduto({ produto, cor, onClick }: {
  produto: Produto
  cor: (typeof CORES)[number]
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
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.12em]"
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
        {beneficios(produto).map((b) => (
          // `items-start` + `shrink-0`: nesta largura os itens longos quebram
          // em duas linhas, e sem isso o check escorregaria pro meio do texto.
          <li key={b} className="flex items-start gap-1.5 text-[11px] text-white/65 leading-snug">
            <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0 mt-[3px]" aria-hidden="true"
                 fill="none" stroke={cor.forte} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 5 5L20 7" />
            </svg>
            {b}
          </li>
        ))}
      </ul>

      <span className="mt-4 self-start px-4 py-2 rounded-xl text-base font-extrabold"
            style={{ background: cor.forte, color: cor.precoTexto }}>
        R$ {brl(produto.price)}
      </span>
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
