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

// A segunda linha GIRA. Num banner pequeno não cabe explicar a mecânica
// inteira de uma vez, e texto longo em barra estreita ninguém lê. As três
// frases dizem coisas diferentes e todas são verdade: a regra, como se pontua
// e o que fazer agora.
const FRASES = [
  "Quem mais amigos trouxer em novembro e dezembro leva. São duas.",
  "Cada amigo que comprar conta um ponto pra você.",
  "Toque e pegue o seu link de convite.",
]

// Trocar a cada 4,2s: tempo de ler uma linha curta sem a barra virar um
// letreiro piscando.
const INTERVALO = 4200
const FADE = 220

export default function BannerIndicacao() {
  const [mostrar, setMostrar] = useState(false)
  const [frase, setFrase] = useState(0)
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
        setFrase((i) => (i + 1) % FRASES.length)
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

  return (
    <a
      href={DESTINO}
      // `data-zona-escura`: o fundo é o gradiente rosa da marca nos DOIS temas,
      // então o texto tem que continuar branco também no tema claro — sem a
      // marca, a camada do claro escurece e o texto some no rosa.
      data-zona-escura
      className="relative flex items-center gap-3 sm:gap-4 rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
      style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 8px 30px rgba(240,25,107,0.30)" }}
    >
      {/* Foto do produto no lugar do emoji: a promoção é de um objeto, e
          objeto se mostra. `alt` vazio porque o texto ao lado já diz o que é —
          leitor de tela não precisa ouvir duas vezes.
          Nome do arquivo com a data: `public/` fica em cache por horas, então
          trocar a foto exige nome novo, nunca sobrescrever. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/garrafa-fizmusica-2026-11.jpg"
        alt=""
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0 shadow-md"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm sm:text-base font-bold leading-snug">
          Indique amigos e leve a garrafa Fiz Música
        </p>
        {/* "trouxer", não "indicar": o ranking é por amigo que COMPROU (a
            conversão já exclui quem usa o próprio link). Prometer por convite
            enviado faria quem clicou muito reclamar com razão.
            Altura mínima de duas linhas: sem ela o banner pula de tamanho a
            cada troca de frase, e o conteúdo abaixo dança junto. */}
        <p className={`text-[13px] sm:text-sm text-white/85 leading-snug mt-0.5 min-h-[2.4em] transition-opacity duration-200 ${nitido ? "opacity-100" : "opacity-0"}`}>
          {FRASES[frase]}
        </p>
      </div>

      {/* No celular o cartão inteiro é o alvo e a seta basta; do sm pra cima
          entra o rótulo, que deixa a ação explícita sem apertar o texto. */}
      <span className="shrink-0 hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-bold">
        Quero indicar →
      </span>
      <span className="shrink-0 sm:hidden text-lg" aria-hidden="true">→</span>

      <button
        onClick={fechar}
        aria-label="Fechar aviso"
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/60 text-white/80 hover:text-white text-sm leading-none flex items-center justify-center backdrop-blur"
      >
        ×
      </button>
    </a>
  )
}
