"use client"

import { useRef, useState } from "react"
import { track } from "@/lib/track"

// ── Primeira tela de quem cai DIRETO no /criar (anúncio, link compartilhado) ──
//
// 24/11/2026: com o banner de ocasiões aqui, ninguém do pamela-v4 tocou em
// nada e quase todos saíam nos primeiros segundos. A pessoa vinha de um reel
// com o casal do churrasco, "Ele contou → virou música" e R$ 12,90, e caía num
// formulário ("Etapa 1 de 5", Voltar) com outra foto, que trocava sozinha em
// 6,5s. Esta tela CONTINUA o anúncio: a mesma cena, a mesma frase, o play ali
// mesmo (o vídeo toca no lugar da foto, sem janela por cima), e um botão só,
// que desce até os temas. A Pâmela não troca sozinha.
//
// A frase "Ele contou" e o verso são do pedido real da Pâmela (o mesmo do
// anúncio). Capa = 1º quadro do vídeo; arquivo novo, nome novo (cache de 4h
// do public/).
export default function RecepcaoAnuncio({ onCriar }: { onCriar: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [tocando, setTocando] = useState(false)

  function ouvir() {
    track("recepcao", "hero_ouvir")
    setTocando(true)
    // play() dentro do mesmo toque: o navegador do Instagram só libera som
    // com gesto da pessoa.
    const v = video.current
    if (v) { v.muted = false; v.play().catch(() => {}) }
  }

  return (
    <section className="mb-7 max-w-[420px] mx-auto">
      <div data-zona-escura className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#140c1f] shadow-[0_20px_60px_-20px_rgba(240,25,107,0.45)]">
        <div className={`relative w-full transition-[height] duration-500 ${tocando ? "h-[min(64svh,560px)]" : "h-[240px]"}`}>
          <video
            ref={video}
            src="/videos/exemplos/pamela.mp4"
            poster="/videos/exemplos/pamela-churrasco.jpg"
            playsInline
            preload="none"
            controls={tocando}
            onEnded={() => track("recepcao", "hero_fim")}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: tocando ? "contain" : "cover", objectPosition: "50% 42%", background: "#07060d" }}
          />
          {!tocando && (
            <button type="button" onClick={ouvir} aria-label="Ouvir a música da Pâmela"
                    className="absolute inset-0 flex items-end justify-start p-4 text-left"
                    style={{ background: "linear-gradient(180deg, rgba(7,6,13,0) 35%, rgba(7,6,13,0.85) 100%)" }}>
              <span className="absolute top-3 left-3 text-[12px] font-semibold text-white rounded-full px-2.5 py-1 bg-black/45 backdrop-blur">
                Exemplo real
              </span>
              <span className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                      style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
                  <svg viewBox="0 0 24 24" className="w-5 h-5 ml-0.5" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
                </span>
                <span>
                  <span className="block text-[16px] font-bold text-white leading-tight">Ouça a música da Pâmela</span>
                  <span className="block text-[13px] text-white/70">40 segundos · com som</span>
                </span>
              </span>
            </button>
          )}
        </div>

        <div className="px-4 pt-4 pb-4">
          <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-white/50">Ele contou</p>
          <p className="text-[15px] text-white/85 leading-snug mt-1">
            “Conheci a Pâmela por amigos em comum… num churrasco a conversa fluiu”
          </p>
          <p className="text-[11px] font-bold tracking-[0.12em] uppercase mt-3" style={{ color: "#ff5cbf" }}>↓ Virou música</p>
          <p className="text-[17px] font-semibold italic leading-snug mt-1" style={{ color: "#ff8fd3" }}>
            ♪ Mas focar em você é o meu melhor talento
          </p>

          <button type="button"
                  onClick={() => { track("recepcao", "hero_criar"); onCriar() }}
                  className="mt-4 w-full rounded-2xl py-3.5 text-base font-semibold text-white active:scale-[0.99] transition-transform"
                  style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 10px 30px -10px rgba(240,25,107,0.8)" }}>
            Criar a minha música
          </button>
        </div>
      </div>

      <ol className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["1", "Conte a história", "uns 3 minutos"],
          ["2", "Veja o refrão", "grátis"],
          ["3", "Receba 2 versões", "a 2ª é grátis"],
        ].map(([n, t, sub]) => (
          <li key={n} className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2.5">
            <span className="block text-[13px] font-bold text-pink-400">{n}</span>
            <span className="block text-[13px] text-white leading-tight">{t}</span>
            <span className={`block text-[12px] mt-0.5 ${n !== "1" ? "text-emerald-400" : "text-white/50"}`}>{sub}</span>
          </li>
        ))}
      </ol>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-white/55">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        Pagamento seguro pelo Mercado Pago · PIX ou cartão
      </p>
    </section>
  )
}
