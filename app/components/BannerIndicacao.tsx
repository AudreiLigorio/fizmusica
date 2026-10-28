"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

// Banner da promoção das garrafas (nov/dez de 2026).
//
// Mora na home e no SpotFiz, que é onde o Audrei pediu. Leva pra aba Carreira,
// onde vive o bloco "Indique amigos" — a âncora `#indicar-amigos` já existia.
//
// Três travas que um banner de promoção precisa ter e quase nunca tem:
//
// 1. SÓ PRA QUEM TEM CONTA. Indicar exige um código de indicação, que só existe
//    pra cliente logado. Mostrar "indique amigos" pra visitante é convidar pro
//    que ele não consegue fazer — e a promoção é de recompra, não de aquisição.
//
// 2. MORRE SOZINHO. A data de fim é fixa: em 1º de janeiro o banner some sem
//    ninguém precisar lembrar de tirar. Promoção vencida no ar é promessa
//    quebrada, e é o erro mais comum desse tipo de peça.
//
// 3. PODE SER FECHADO. São dois meses de campanha; sem o "×", quem já decidiu
//    não participar levaria o mesmo recado em toda visita.
const FIM = new Date("2027-01-01T03:00:00Z") // 1º de janeiro, 00h de Brasília
const CHAVE = "fm_banner_indicacao_fechado"

// O destino já existe: a aba Carreira monta o bloco com `id="indicar-amigos"`.
// `<a href>` de propósito, em vez de `router.push`: navegação de verdade
// garante que o navegador role até a âncora. Com push do roteador, o hash
// costuma ser ignorado quando o elemento ainda não está montado.
const DESTINO = "/minha-musica?aba=carreira#indicar-amigos"

// DUAS FACES que se alternam, cada uma com cor e enquadramento próprios.
//
// Cor fora da paleta da marca, de propósito: a página inteira é rosa e
// fúcsia, e um banner rosa no meio dela vira mais um bloco. Âmbar e azul
// destacam — é o mesmo truque da arte que o Audrei trouxe de referência, que
// usa laranja forte num site que não é laranja.
//
// A imagem não muda de arquivo: muda o ENQUADRAMENTO da mesma foto. A face 1
// mostra a garrafa preta, a 2 mostra a branca. Sai mais leve que duas fotos e
// a troca fica nítida do mesmo jeito.
const FACES = [
  {
    cor: "linear-gradient(100deg, #b45309 0%, #f59e0b 100%)",
    enquadramento: "30% center",
    chapeu: "Novembro e dezembro",
    titulo: ["Indique amigos", "e leve a garrafa"],
    frase: "São duas garrafas térmicas da Fiz Música.",
  },
  {
    cor: "linear-gradient(100deg, #0e7490 0%, #0284c7 100%)",
    enquadramento: "64% center",
    chapeu: "Como funciona",
    titulo: ["Cada amigo que", "comprar vale ponto"],
    frase: "Quem mais trouxer em novembro e dezembro leva.",
  },
]

// 5,5s por face: tempo de ler o título e a linha sem a peça virar letreiro.
const INTERVALO = 5500
const FADE = 400

export default function BannerIndicacao() {
  const [mostrar, setMostrar] = useState(false)
  const [face, setFace] = useState(0)
  const [nitido, setNitido] = useState(true)

  useEffect(() => {
    if (Date.now() >= FIM.getTime()) return
    try {
      if (localStorage.getItem(CHAVE) === "1") return
    } catch {
      /* navegador sem localStorage: segue e mostra */
    }
    // O MESMO par que o Header usa, e não só a consulta direta.
    //
    // `getSession()` pode responder ANTES de o cliente terminar de restaurar a
    // sessão guardada — e aí o banner não aparece pra quem está logado, que é
    // exatamente quem ele atende. Foi o que aconteceu no primeiro deploy.
    // O assinante pega o evento que chega logo depois (sessão restaurada,
    // token renovado, login na outra aba).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setMostrar(true)
    }).catch(() => {})

    const { data: sub } = supabase.auth.onAuthStateChange((_e, sessao) => {
      if (sessao) setMostrar(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Giro das frases. Duas guardas que um letreiro precisa ter:
  //
  // - RESPEITA QUEM PEDIU MENOS MOVIMENTO no sistema: nesse caso fica parado
  //   na primeira frase, que já contém a regra.
  // - PARA COM A ABA ESCONDIDA: sem isso o timer segue rodando em segundo
  //   plano, gastando bateria pra trocar um texto que ninguém está vendo.
  useEffect(() => {
    if (!mostrar) return
    const menosMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    if (menosMovimento) return

    let troca: ReturnType<typeof setTimeout> | undefined
    const giro = setInterval(() => {
      if (document.hidden) return
      setNitido(false)
      troca = setTimeout(() => {
        setFace((i) => (i + 1) % FACES.length)
        setNitido(true)
      }, FADE)
    }, INTERVALO)

    return () => { clearInterval(giro); if (troca) clearTimeout(troca) }
  }, [mostrar])

  if (!mostrar) return null

  function fechar(e: React.MouseEvent) {
    // `preventDefault` + `stopPropagation`: o "×" vive DENTRO do link, e sem
    // isso fechar o banner também navegaria pra Carreira.
    e.preventDefault()
    e.stopPropagation()
    try { localStorage.setItem(CHAVE, "1") } catch { /* ignora */ }
    setMostrar(false)
  }

  const atual = FACES[face]

  return (
    <a
      href={DESTINO}
      // `data-zona-escura`: o fundo é cor forte e foto nos DOIS temas, e o
      // texto por cima é sempre branco. Sem a marca, a camada do tema claro
      // escureceria o texto e ele sumiria dentro da arte.
      data-zona-escura
      // PEÇA GRÁFICA, não cartão com foto ao lado. Construída em CSS e não
      // como um JPG pronto: banner de imagem única tem proporção fixa, e a
      // arte de referência é bem deitada (~2,5:1) — num celular de 375px isso
      // vira uma faixa de 150px com tipografia ilegível. Loja grande resolve
      // publicando duas artes, uma por formato. Aqui o texto é texto: nítido
      // em qualquer largura, e trocar a foto não exige redesenhar nada.
      className="group relative block overflow-hidden rounded-2xl text-white shadow-xl transition-transform hover:scale-[1.01] active:scale-[0.99]"
      style={{ boxShadow: "0 10px 36px rgba(0,0,0,0.25)" }}
    >
      {/* As duas faces ficam SEMPRE montadas, uma por cima da outra, e o que
          muda é a opacidade. Gradiente não anima em CSS — trocar o valor no
          mesmo elemento daria um salto seco de cor. Empilhadas, a troca é um
          crossfade de verdade. */}
      {FACES.map((f, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`absolute inset-0 transition-opacity ease-in-out ${i === face ? "opacity-100" : "opacity-0"}`}
          style={{ background: f.cor, transitionDuration: `${FADE}ms` }}
        />
      ))}

      {/* O produto, encostado à direita e derretendo na cor.
          A máscara é o que substitui o recorte: sem um PNG de fundo
          transparente, é ela que faz a foto virar parte da arte em vez de um
          retângulo colado por cima.
          Cada face enquadra a foto num ponto diferente — é daí que vem a
          "troca de imagem" sem baixar um segundo arquivo. */}
      {FACES.map((f, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`absolute inset-y-0 right-0 w-[52%] sm:w-[46%] bg-cover transition-opacity ease-in-out group-hover:scale-105 duration-500 ${
            i === face ? "opacity-100" : "opacity-0"
          }`}
          style={{
            backgroundImage: "url(/garrafa-banner-2026-11.jpg)",
            backgroundPosition: f.enquadramento,
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 42%)",
            maskImage: "linear-gradient(to right, transparent 0%, #000 42%)",
          }}
        />
      ))}

      {/* Conteúdo. `max-w` segura o texto à esquerda pra ele nunca invadir a
          foto. As alturas mínimas evitam que a peça mude de tamanho entre as
          faces — sem elas, o conteúdo de baixo da página dança a cada troca. */}
      <div
        className={`relative px-5 py-6 sm:px-8 sm:py-9 max-w-[62%] sm:max-w-[58%] transition-opacity ease-in-out ${
          nitido ? "opacity-100" : "opacity-0"
        }`}
        style={{ transitionDuration: `${FADE}ms` }}
      >
        <p className="text-[11px] sm:text-[13px] font-bold uppercase tracking-[0.18em] text-white/85">
          {atual.chapeu}
        </p>

        <p className="mt-1.5 text-[26px] sm:text-[40px] font-extrabold leading-[0.95] tracking-tight drop-shadow-sm min-h-[2em]">
          {atual.titulo[0]}<br />{atual.titulo[1]}
        </p>

        <span className="mt-3 inline-flex items-center rounded-lg bg-black/30 backdrop-blur px-3 py-1.5 text-[13px] sm:text-sm font-semibold min-h-[2.1em]">
          {atual.frase}
        </span>

        <span className="mt-4 flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] sm:text-sm font-bold text-neutral-900 shadow-md">
          Quero indicar
          <span aria-hidden="true">→</span>
        </span>
      </div>

      <button
        onClick={fechar}
        aria-label="Fechar aviso"
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/45 text-white/85 hover:text-white hover:bg-black/70 text-base leading-none flex items-center justify-center backdrop-blur transition-colors"
      >
        ×
      </button>
    </a>
  )
}
