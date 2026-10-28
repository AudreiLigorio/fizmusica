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

export default function BannerIndicacao() {
  const [mostrar, setMostrar] = useState(false)

  useEffect(() => {
    if (Date.now() >= FIM.getTime()) return
    try {
      if (localStorage.getItem(CHAVE) === "1") return
    } catch {
      /* navegador sem localStorage: segue e mostra */
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setMostrar(true)
    }).catch(() => {})
  }, [])

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
      <span className="text-2xl sm:text-3xl leading-none shrink-0" aria-hidden="true">🥤</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm sm:text-base font-bold leading-snug">
          Indique amigos e leve a garrafa Fiz Música
        </p>
        {/* "trouxer", não "indicar": o ranking é por amigo que COMPROU (a
            conversão já exclui quem usa o próprio link). Prometer por convite
            enviado faria quem clicou muito reclamar com razão. */}
        <p className="text-[13px] sm:text-sm text-white/85 leading-snug mt-0.5">
          Quem mais amigos trouxer em novembro e dezembro leva. São duas.
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
