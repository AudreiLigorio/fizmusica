"use client"

import { useRef, useState, type ReactNode } from "react"
import MicButton from "../components/MicButton"
import { track } from "@/lib/track"
import { DICAS_OCASIAO, HISTORIA_MAX } from "@/lib/wizardHistoria"
import type { WizardOccasion } from "@/lib/wizard"

// ── Telas da versão B do wizard ("campo primeiro") ──
//
// Só a APRESENTAÇÃO das duas telas novas. Estado, validação, sessão e envio
// continuam no CriarClient (fonte única), que passa valores e callbacks.
// Regra do teste e de dados: lib/wizardHistoria.ts.
//
// Mesmo vocabulário de classes do resto do wizard (text-white/…, bg-black/40,
// border-white/10, rosa): é ele que o tema claro do globals.css reconhece e
// troca. Cor nova escrita à mão aqui não acompanharia o tema claro.

// ── Faixa compacta com o exemplo da Pâmela (o mesmo do anúncio) ──
// Fechada ocupa uma linha; o toque abre o vídeo ali mesmo, com som (o play
// acontece dentro do toque, que é o que o navegador do Instagram exige).
function ExemploPamela() {
  const video = useRef<HTMLVideoElement>(null)
  const [aberto, setAberto] = useState(false)

  function abrir() {
    track("recepcao", "historia_ouvir")
    setAberto(true)
    const v = video.current
    if (v) { v.muted = false; v.play().catch(() => {}) }
  }

  return (
    <div data-zona-escura className="rounded-2xl overflow-hidden bg-[#140c1f] border border-white/10">
      <video
        ref={video}
        src="/videos/exemplos/pamela.mp4"
        poster="/videos/exemplos/pamela-churrasco.jpg"
        playsInline
        preload="none"
        controls={aberto}
        className={aberto ? "block w-full h-[min(56svh,480px)]" : "hidden"}
        style={{ objectFit: "contain", background: "#07060d" }}
      />
      {!aberto && (
        <button type="button" onClick={abrir} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left">
          <span className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 ml-0.5" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-white leading-snug">Ele contou como conheceu a Pâmela. Virou música.</span>
            <span className="block text-[13px] text-white/60">Ouça o exemplo · 40 segundos</span>
          </span>
        </button>
      )}
    </div>
  )
}

// ── Tela 1 da B: para quem + a história ──
export function PrimeiraTelaHistoria(props: {
  honoreeName: string
  setHonoreeName: (v: string) => void
  historia: string
  setHistoria: (fn: (atual: string) => string) => void
  dica: string
  setDica: (v: string) => void
  enviando: boolean
  /** Teclado aberto: o botão vai pra barra fixa acima dele (CriarClient). */
  esconderBotao?: boolean
  onContinuar: () => void
  onGuiado: () => void
  onLetraPronta?: () => void
}) {
  const [interim, setInterim] = useState("")
  const digitou = useRef(false)

  // "Começou a digitar" é o sinal precoce do teste: dispara uma vez, no
  // primeiro caractere em qualquer um dos dois campos (ou no microfone).
  function marcarDigitou() {
    if (digitou.current) return
    digitou.current = true
    track("recepcao", "historia_digitou")
  }

  return (
    <section className="max-w-[520px] mx-auto flex flex-col gap-4">
      <ExemploPamela />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="campo-homenageado" className="text-[22px] font-bold tracking-tight">Para quem é a música?</label>
        <input
          id="campo-homenageado"
          value={props.honoreeName}
          onChange={(e) => { marcarDigitou(); props.setHonoreeName(e.target.value) }}
          placeholder="Nome de quem vai receber"
          autoComplete="off"
          maxLength={60}
          className="w-full bg-black/40 border-2 border-pink-500/70 rounded-2xl px-4 py-3.5 text-base outline-none focus:border-pink-500 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] text-white/55">Ocasião (opcional)</p>
        <div className="flex flex-wrap gap-1.5">
          {DICAS_OCASIAO.map((d) => {
            const ativa = props.dica === d
            return (
              <button key={d} type="button" aria-pressed={ativa}
                      onClick={() => props.setDica(ativa ? "" : d)}
                      className={`rounded-full px-3 py-1.5 text-[14px] border transition-colors ${
                        ativa ? "border-pink-500 bg-pink-500/10 text-pink-400 font-semibold" : "border-white/15 bg-black/30 text-white/85"
                      }`}>
                {d}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="campo-historia" className="text-base font-semibold">Conte a história</label>
        <div className="relative">
          <textarea
            id="campo-historia"
            rows={5}
            value={props.historia}
            maxLength={HISTORIA_MAX}
            onChange={(e) => { marcarDigitou(); const v = e.target.value; props.setHistoria(() => v) }}
            placeholder="Como se conheceram, um momento que marcou, o jeito dela… Escreva do seu jeito, sem se preocupar com rima."
            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 pb-14 text-base leading-relaxed outline-none focus:border-pink-500 resize-none transition-colors placeholder:text-white/35"
          />
          <div className="absolute bottom-3 right-3">
            <MicButton
              onResult={(t) => { marcarDigitou(); props.setHistoria((atual) => (atual ? atual.trimEnd() + " " + t : t)) }}
              onInterim={setInterim}
            />
          </div>
        </div>
        {interim && <p className="text-sm text-pink-300/70 px-1 italic animate-pulse">🎤 {interim}…</p>}
        <p className="text-[13px] text-white/55">Quanto mais detalhe, mais a letra fica com a cara de vocês.</p>
      </div>

      <button type="button" onClick={props.onContinuar} disabled={props.enviando}
              className={`${props.esconderBotao ? "hidden" : ""} w-full py-4 rounded-2xl text-base font-semibold text-white disabled:opacity-70 flex items-center justify-center gap-3`}
              style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 4px 20px rgba(240,25,107,0.35)" }}>
        {props.enviando
          ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Lendo a sua história…</>
          : "Continuar →"}
      </button>

      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={props.onGuiado} className="text-[14px] text-white/60 underline underline-offset-4 decoration-white/25">
          Prefere que a gente pergunte? Responder perguntas
        </button>
        {props.onLetraPronta && (
          <button type="button" onClick={props.onLetraPronta} className="text-[14px] text-white/60 underline underline-offset-4 decoration-white/25">
            Já tem a letra pronta? Cole aqui
          </button>
        )}
      </div>

      <p className="text-center text-[13px] text-white/50">Refrão grátis antes de pagar · Seus dados só no final</p>
    </section>
  )
}

// ── Faixa "Entendemos: tema · subtema [Trocar]" ──
// Mostra o que a IA escolheu e deixa trocar por uma lista (o catálogo real).
// `obrigatorio`: a IA falhou e a pessoa PRECISA escolher — a lista já vem
// aberta e sem nada marcado.
export function TemaEntendido(props: {
  temas: WizardOccasion[]
  context: string
  subcategory: string
  obrigatorio?: boolean
  onTrocar: (context: string, subcategory: string) => void
}) {
  const [abrindo, setAbrindo] = useState(false)
  const aberto = abrindo || props.obrigatorio || !props.context
  const valor = props.context && props.subcategory ? `${props.context}|||${props.subcategory}` : ""

  return (
    <div id="secao-tema" className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 scroll-mt-6">
      {!aberto ? (
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-fuchsia-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
          </svg>
          <p className="text-sm text-white/70 leading-snug flex-1 min-w-0">
            Entendemos: <span className="font-semibold text-white">{props.context}</span> · {props.subcategory}
          </p>
          <button type="button" onClick={() => setAbrindo(true)} className="text-sm font-semibold underline underline-offset-2 text-white/85">Trocar</button>
        </div>
      ) : (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-white/85">Qual é a ocasião da música?</span>
          <select
            value={valor}
            onChange={(e) => {
              const [c, s] = e.target.value.split("|||")
              if (c && s) { props.onTrocar(c, s); setAbrindo(false) }
            }}
            className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-3 text-base outline-none focus:border-pink-500"
          >
            <option value="" disabled>Escolha a ocasião</option>
            {props.temas.map((o) => (
              <optgroup key={o.id} label={o.label}>
                {o.wizard_subcategories.map((s) => (
                  <option key={s.id} value={`${o.label}|||${s.label}`}>{s.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

// ── Tela 2 da B: a pergunta extra (só quando a IA pediu) ──
// Sem pergunta (a IA falhou e só falta o tema), a tela é só a escolha do tema.
export function PerguntaExtraTela(props: {
  tema: ReactNode
  pergunta: string
  resposta: string
  setResposta: (fn: (atual: string) => string) => void
  esconderBotao?: boolean
  onContinuar: () => void
  onPular: () => void
}) {
  const [interim, setInterim] = useState("")
  return (
    <section className="max-w-[520px] mx-auto flex flex-col gap-4">
      {props.tema}

      {props.pergunta ? (
        <>
          <div className="flex flex-col gap-1.5 mt-1">
            <h1 className="text-2xl font-bold tracking-tight">Só mais uma pergunta</h1>
            <p className="text-[15px] text-white/60 leading-relaxed">Sua história ficou curtinha. Um detalhe a mais deixa a letra com a cara de vocês.</p>
          </div>

          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <label htmlFor="campo-pergunta-extra" data-contexto-teclado className="text-lg font-semibold leading-snug">{props.pergunta}</label>
            <div className="relative">
              <textarea
                id="campo-pergunta-extra"
                rows={4}
                value={props.resposta}
                onChange={(e) => { const v = e.target.value; props.setResposta(() => v) }}
                placeholder="Pode ser simples: uma viagem, uma piada só de vocês, o dia em que…"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 pb-14 text-base leading-relaxed outline-none focus:border-pink-500 resize-none transition-colors placeholder:text-white/35"
              />
              <div className="absolute bottom-3 right-3">
                <MicButton
                  onResult={(t) => props.setResposta((atual) => (atual ? atual.trimEnd() + " " + t : t))}
                  onInterim={setInterim}
                />
              </div>
            </div>
            {interim && <p className="text-sm text-pink-300/70 px-1 italic animate-pulse">🎤 {interim}…</p>}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1.5 mt-1">
          <h1 className="text-2xl font-bold tracking-tight">Qual é a ocasião?</h1>
          <p className="text-[15px] text-white/60 leading-relaxed">Escolha na lista acima para a letra combinar com o momento.</p>
        </div>
      )}

      <button type="button" onClick={props.onContinuar} data-acao-teclado
              className={`${props.esconderBotao ? "hidden" : ""} w-full py-4 rounded-2xl text-base font-semibold text-white`}
              style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 4px 20px rgba(240,25,107,0.35)" }}>
        Continuar →
      </button>
      {props.pergunta && (
        <button type="button" onClick={props.onPular} className="text-[14px] text-white/60 underline underline-offset-4 decoration-white/25 self-center">
          Pular esta pergunta
        </button>
      )}
    </section>
  )
}
