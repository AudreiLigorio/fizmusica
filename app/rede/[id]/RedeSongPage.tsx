"use client"

import { useEffect, useRef, useState } from "react"
import { idDeSessao } from "@/lib/track"

// Tela pública de uma música da Rede. Mesma linguagem visual do player da
// Rede (fundo com a capa borrada, capa no meio, letra rolando), mas é uma
// PÁGINA, não uma camada: quem chega aqui veio de um link e não tem pra onde
// voltar, então em vez de um "fechar" há um caminho pra frente — ouvir o
// resto da Rede ou criar a própria música.
//
// Sem fotos, por definição. Ver o comentário em page.tsx.

type Dados = {
  orderId: string
  titulo: string
  ocasiao: string
  estilo: string | null
  imageUrl: string | null
  lyrics: string | null
  lyricsLrc: string | null
  apelido: string | null
  plays: number
}

type LrcLine = { time: number; text: string }

function parseLrc(lrc: string): LrcLine[] {
  const out: LrcLine[] = []
  for (const raw of lrc.split("\n")) {
    const m = raw.trim().match(/^\[(\d{2}):(\d{2})\.(\d{1,3})\](.*)$/)
    if (!m) continue
    const ms = m[3].padEnd(3, "0")
    const texto = m[4].trim()
    if (texto) out.push({ time: parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(ms) / 1000, text: texto })
  }
  return out
}

function fmt(s: number): string {
  if (!s || isNaN(s)) return "0:00"
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`
}

export default function RedeSongPage({ dados, publicUrl }: { dados: Dados; publicUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const caixaLetraRef = useRef<HTMLDivElement>(null)
  const linhaAtivaRef = useRef<HTMLParagraphElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [copiado, setCopiado] = useState(false)

  const lrc = dados.lyricsLrc ? parseLrc(dados.lyricsLrc) : []
  const linhas = lrc.length > 0
    ? lrc.map((l) => l.text)
    : (dados.lyrics ?? "").split("\n").map((l) => l.trim()).filter((l) => l && !/^\[.*\]$/.test(l))

  // Sem LRC não há linha ativa: a letra fica estática, que é o certo — piscar
  // linha por estimativa erraria e distrairia.
  const ativa = lrc.length > 0 ? lrc.findIndex((l, i) => progress >= l.time && (i === lrc.length - 1 || progress < lrc[i + 1].time)) : -1

  // scrollTop da própria caixa, nunca scrollIntoView: ele rola todos os
  // ancestrais roláveis e arrastaria a página inteira junto.
  useEffect(() => {
    const caixa = caixaLetraRef.current
    const linha = linhaAtivaRef.current
    if (!caixa || !linha) return
    const c = caixa.getBoundingClientRect()
    const l = linha.getBoundingClientRect()
    caixa.scrollTo({ top: caixa.scrollTop + (l.top - c.top) - (c.height / 2 - l.height / 2), behavior: "smooth" })
  }, [ativa])

  function alternar() {
    const a = audioRef.current
    if (!a) return
    if (a.paused) { a.play().catch(() => {}); setPlaying(true) }
    else { a.pause(); setPlaying(false) }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* clipboard bloqueado: o link continua na barra do navegador */ }
  }

  const textoWhats = `Ouve essa música que achei na Fiz Música: "${dados.titulo}" — ${publicUrl}`

  return (
    <div className="relative isolate min-h-[100dvh] text-white overflow-hidden" style={{ background: "#0b0812" }}>
      {/* Fundo ambiente: a capa borrada, no lugar que as fotos ocupam no
          player do pedido. `scale` cobre as bordas translúcidas do blur. */}
      {dados.imageUrl && (
        <div
          aria-hidden="true"
          className="fixed inset-0"
          style={{
            backgroundImage: `url(${dados.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center",
            filter: "blur(48px) saturate(1.5)", transform: "scale(1.25)", opacity: 0.5,
          }}
        />
      )}
      <div
        aria-hidden="true"
        className="fixed inset-0"
        style={{ background: "linear-gradient(180deg, rgba(11,8,18,.5) 0%, rgba(11,8,18,.8) 45%, #0b0812 100%)" }}
      />

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={`/api/audio?o=${encodeURIComponent(dados.orderId)}`}
        onTimeUpdate={(e) => { setProgress(e.currentTarget.currentTime); setDuration(e.currentTarget.duration || 0) }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => setPlaying(false)}
        // Conta a reprodução no play real, como na Rede — assim o Top 10
        // enxerga também quem ouviu por um link compartilhado.
        onPlay={() => {
          fetch("/api/musicas/play", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: dados.orderId, sessao: idDeSessao() }),
          }).catch(() => {})
        }}
      />

      <div className="relative z-10 max-w-lg mx-auto px-6 pt-10 pb-12 flex flex-col items-center text-center">
        <a href="/minha-musica?aba=musicas" className="text-[11px] uppercase tracking-wider font-bold text-white/40 hover:text-white/70 transition-colors mb-6">
          Rede Fiz Música
        </a>

        <div
          className="rounded-2xl bg-cover bg-center border border-white/10 shadow-2xl mb-6"
          style={{
            width: "min(70vw, 280px)", aspectRatio: "1",
            ...(dados.imageUrl ? { backgroundImage: `url(${dados.imageUrl})` } : { background: "linear-gradient(135deg,#3a1440,#7a1f5c)" }),
          }}
        />

        <h1 className="text-2xl font-bold leading-tight" style={{ textWrap: "balance" }}>{dados.titulo}</h1>
        <p className="text-sm text-white/45 mt-1.5">
          {[dados.ocasiao, dados.estilo].filter(Boolean).join(" · ")}
        </p>
        <p className="text-[11px] text-white/30 mt-1">
          {dados.apelido ? `publicada por ${dados.apelido}` : "publicada por um membro da Rede"}
          {dados.plays > 0 && ` · ${dados.plays} ${dados.plays === 1 ? "reprodução" : "reproduções"}`}
        </p>

        <button
          onClick={alternar}
          aria-label={playing ? "Pausar" : "Tocar"}
          className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center mt-7 mb-4 shadow-xl hover:scale-105 active:scale-95 transition-transform"
        >
          {playing ? (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg className="w-6 h-6 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>

        <div className="w-full flex items-center gap-3">
          <span className="text-[11px] text-white/40 font-mono shrink-0">{fmt(progress)}</span>
          <input
            type="range" min={0} max={duration || 0} step={0.1} value={progress}
            onChange={(e) => { const v = Number(e.target.value); if (audioRef.current) audioRef.current.currentTime = v; setProgress(v) }}
            aria-label="Posição da música"
            className="flex-1 accent-pink-500 h-1 cursor-pointer"
          />
          <span className="text-[11px] text-white/40 font-mono shrink-0">{fmt(duration)}</span>
        </div>

        {linhas.length > 0 ? (
          <div
            ref={caixaLetraRef}
            className="w-full h-[300px] overflow-y-auto mt-8"
            style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)" }}
          >
            <div className="flex flex-col gap-3 py-16">
              {linhas.map((linha, i) => {
                const isActive = i === ativa
                const isNear = ativa >= 0 && Math.abs(i - ativa) <= 1
                return (
                  <p
                    key={i}
                    ref={isActive ? linhaAtivaRef : undefined}
                    className="select-none transition-all duration-500 px-2"
                    style={{
                      fontSize: isActive ? "1.2rem" : isNear ? "1rem" : ".9rem",
                      fontWeight: isActive ? 700 : isNear ? 500 : 400,
                      // Sem LRC não há linha ativa, e deixar tudo a 25% ficaria
                      // ilegível: a letra estática vale mais clara.
                      color: ativa < 0 ? "rgba(255,255,255,.6)" : isActive ? "#fff" : isNear ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.25)",
                      textShadow: isActive ? "0 0 20px rgba(236,72,153,.6)" : "none",
                    }}
                  >
                    {linha}
                  </p>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/25 mt-10">Esta música não tem letra publicada.</p>
        )}

        <div className="w-full mt-8">
          <p className="text-[11px] text-white/30 mb-2 tracking-wide">compartilhar</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={copiar} className="flex flex-col items-center gap-1 group" title={copiado ? "Copiado!" : "Copiar link"}>
              <span className="w-11 h-11 rounded-full bg-white/8 border border-white/10 flex items-center justify-center group-hover:bg-white/14 group-active:scale-95 transition-all">
                {copiado ? (
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" /></svg>
                )}
              </span>
              <span className="text-[10px] text-white/40">{copiado ? "copiado" : "link"}</span>
            </button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(textoWhats)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 group" title="Compartilhar no WhatsApp"
            >
              <span className="w-11 h-11 rounded-full bg-white/8 border border-white/10 flex items-center justify-center group-hover:bg-white/14 group-active:scale-95 transition-all">
                <svg className="w-5 h-5 text-green-400/80" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </span>
              <span className="text-[10px] text-white/40">whatsapp</span>
            </a>
          </div>
        </div>

        {/* O caminho pra frente. Quem abriu este link é, quase sempre, alguém
            que ainda não é cliente — é o momento mais barato de conversão que
            a gente tem. */}
        <a
          href="/criar"
          className="w-full mt-9 block text-center py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
        >
          Criar a minha música
        </a>
        <a href="/minha-musica?aba=musicas" className="text-xs text-white/40 hover:text-white/70 transition-colors mt-4">
          ou ouvir outras músicas da Rede
        </a>
      </div>
    </div>
  )
}
