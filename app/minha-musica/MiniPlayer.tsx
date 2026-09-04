"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePlayer } from "./PlayerContext"
import { idDeSessao } from "@/lib/track"
import { useCatalogo } from "./CatalogoContext"
import { useToast } from "./ToastContext"
import AddToPlaylistModal from "./AddToPlaylistModal"
import CreatePlaylistModal from "./CreatePlaylistModal"

// Ícones vetoriais — o "▶" de texto Unicode renderiza torto e com peso
// diferente por aparelho/fonte. Mesmo traço das abas (AreaTabs.tsx).
function IconRepeat() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  )
}
function IconProxima() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true" fill="currentColor">
      <path d="M6 5.3c0-.8.9-1.3 1.5-.9l8.4 5.7c.6.4.6 1.3 0 1.7l-8.4 5.7c-.6.4-1.5 0-1.5-.9Z" />
      <rect x="16.6" y="4.5" width="2.2" height="15" rx="1.1" />
    </svg>
  )
}
function IconAnterior() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true" fill="currentColor">
      <path d="M18 5.3c0-.8-.9-1.3-1.5-.9L8.1 10.1c-.6.4-.6 1.3 0 1.7l8.4 5.7c.6.4 1.5 0 1.5-.9Z" />
      <rect x="5.2" y="4.5" width="2.2" height="15" rx="1.1" />
    </svg>
  )
}
function IconPlay({ size = "w-4 h-4" }: { size?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${size} translate-x-[1px]`} aria-hidden="true" fill="currentColor">
      <path d="M7 4.7c0-1 1.1-1.6 1.9-1.1l11.6 7.3c.8.5.8 1.7 0 2.2L8.9 20.4C8.1 20.9 7 20.3 7 19.3Z" />
    </svg>
  )
}
function IconPause({ size = "w-4 h-4" }: { size?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={size} aria-hidden="true" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1.2" />
      <rect x="14" y="4" width="4" height="16" rx="1.2" />
    </svg>
  )
}

function IconCoracao({ cheio }: { cheio: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"
      fill={cheio ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 5.6a5.1 5.1 0 0 0-7.2 0L12 7.2l-1.6-1.6a5.1 5.1 0 0 0-7.2 7.2l1.6 1.6L12 21.6l7.2-7.2 1.6-1.6a5.1 5.1 0 0 0 0-7.2Z" />
    </svg>
  )
}
function IconMais() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  )
}

function fmt(s: number): string {
  if (!s || isNaN(s)) return "0:00"
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`
}

export default function MiniPlayer() {
  const { track, playing, progress, duration, activeLine, lines, fullOpen, repeat, audioRef, proximaTrack, temProxima, temAnterior, proxima, anterior, toggle, toggleRepeat, seek, openFull, closeFull, onTimeUpdate } = usePlayer()
  const activeLineRef = useRef<HTMLParagraphElement>(null)

  // Ações do player aberto: as MESMAS do card (favoritar e adicionar à
  // playlist), pra quem já está ouvindo não precisar voltar pra lista.
  //
  // `items` do catálogo diz se a faixa é DA REDE — favoritar só existe pra
  // música de outra pessoa (não há o que favoritar na sua própria, e o motor
  // nem registra). O "+" vale pra qualquer uma.
  const { items, alternarFavorito } = useCatalogo()
  const { showToast } = useToast()
  const naRede = items?.find((i) => i.orderId === track?.id) ?? null
  const [playlists, setPlaylists] = useState<{ id: string; nome: string; track_order_ids: string[] }[] | null>(null)
  const [escolhendoPlaylist, setEscolhendoPlaylist] = useState(false)
  const [criandoPlaylist, setCriandoPlaylist] = useState(false)

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" }
  }

  async function favoritar() {
    if (!naRede) return
    alternarFavorito(naRede.orderId)
    const headers = await authHeaders()
    await fetch("/api/catalog/favorite", {
      method: "POST", headers, body: JSON.stringify({ orderId: naRede.orderId }),
    }).catch(() => {})
  }

  async function abrirAdicionar() {
    if (!track) return
    const headers = await authHeaders()
    const d = await fetch("/api/playlists", { headers }).then((r) => r.json()).catch(() => ({}))
    const lista = d.playlists ?? []
    setPlaylists(lista)
    // Uma playlist só? Adiciona direto — o popup de escolher só faz sentido
    // quando há de fato uma escolha. Mesma regra dos cards.
    if (lista.length === 1) adicionarNa(lista[0].id)
    else setEscolhendoPlaylist(true)
  }

  async function adicionarNa(playlistId: string) {
    if (!track) return
    setEscolhendoPlaylist(false)
    const headers = await authHeaders()
    await fetch(`/api/playlists/${playlistId}`, {
      method: "PATCH", headers, body: JSON.stringify({ addOrderId: track.id }),
    })
    showToast("Adicionado com sucesso ✓")
  }

  async function criarPlaylist(nome: string) {
    if (!track) return
    setCriandoPlaylist(false)
    const headers = await authHeaders()
    await fetch("/api/playlists", { method: "POST", headers, body: JSON.stringify({ nome, orderId: track.id }) })
    showToast("Adicionado com sucesso ✓")
  }

  // Mesmo mecanismo real (PublicMusicPlayer.tsx): scrollIntoView na linha
  // ativa dentro do próprio container, nunca a página inteira.
  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [activeLine])

  // Dá play em cada faixa NOVA — inclusive quando a fila emenda sozinha com
  // a tela bloqueada. Um efeito, e não requestAnimationFrame, justamente
  // porque o rAF congela com a página escondida (ver PlayerContext).
  //
  // A trava por id garante um play por faixa: sem ela, qualquer re-render do
  // player (progresso, letra chegando) reiniciaria a música do zero.
  const ultimaTocada = useRef<string | null>(null)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track) return
    if (ultimaTocada.current === track.id) return
    ultimaTocada.current = track.id
    audio.play().catch(() => { /* bloqueado pelo navegador: o botão resolve */ })
  }, [track, audioRef])

  // ── Media Session: som que sobrevive à tela bloqueada ──────────────────
  //
  // Sem isto o navegador trata o <audio> como som qualquer de página e o
  // sistema suspende quando o celular bloqueia — foi o que o Audrei
  // relatou. Declarando a sessão de mídia, o SO passa a tratar como
  // reprodução de verdade: mantém tocando em segundo plano e ainda mostra
  // capa, título e controles na tela de bloqueio e nos fones.
  //
  // Os controles apontam pros MESMOS callbacks dos botões da tela, então
  // pular pela tela de bloqueio anda na mesma fila e respeita o repetir.
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined
    if (!ms || !track) return

    ms.metadata = new MediaMetadata({
      title: track.title,
      // Sem apelido, usa a ocasião: melhor que deixar em branco na tela de
      // bloqueio, que é onde a pessoa vê isso sem contexto nenhum.
      artist: track.apelido ?? track.occasion ?? "Fiz Música",
      album: "Fiz Música",
      artwork: track.imageUrl
        ? [{ src: track.imageUrl, sizes: "512x512", type: "image/jpeg" }]
        : [],
    })

    const acoes: [MediaSessionAction, (() => void) | null][] = [
      ["play", () => toggle()],
      ["pause", () => toggle()],
      ["nexttrack", temProxima ? () => proxima() : null],
      ["previoustrack", temAnterior ? () => anterior() : null],
    ]
    for (const [nome, fn] of acoes) {
      // Navegador antigo pode não conhecer a ação; ignorar é melhor que
      // derrubar o player inteiro por causa de um botão.
      try { ms.setActionHandler(nome, fn) } catch { /* sem essa ação */ }
    }

    return () => {
      for (const [nome] of acoes) {
        try { ms.setActionHandler(nome, null) } catch { /* idem */ }
      }
    }
  }, [track, toggle, proxima, anterior, temProxima, temAnterior])

  // Estado separado do metadata: só isto muda a cada play/pause, e refazer
  // o MediaMetadata a cada toque faria a capa piscar na tela de bloqueio.
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaSession) {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused"
    }
  }, [playing])

  if (!track) return null

  // Música sem nome próprio cai no derivado "Uma canção de {ocasião}" — aí a
  // linha de baixo repetiria a mesma coisa. Nesse caso a ocasião some e sobra
  // só o apelido embaixo, quando houver.
  const ocasiaoRepetida = !!track.occasion && track.title.includes(track.occasion)
  const subtitulo = ocasiaoRepetida ? null : track.occasion

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={track.audioUrl}
        loop={repeat}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onTimeUpdate}
        // Conta a reprodução quando o áudio COMEÇA de fato, não no clique.
        // O <audio> de pré-carregamento nunca dispara isto (é mudo e nunca
        // recebe play), então a fila não infla o ranking com música que
        // ninguém chegou a ouvir. Repetição da mesma sessão é descartada no
        // banco. Falha aqui é ignorada de propósito: contagem não pode
        // atrapalhar quem está ouvindo.
        onPlay={() => {
          fetch("/api/musicas/play", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: track.id, sessao: idDeSessao() }),
          }).catch(() => {})
        }}
        // Ao terminar, emenda na próxima da fila em vez de fechar o player
        // (pedido do Audrei: "igual Spotify"). Com o repetir ligado este
        // evento nem dispara — o `loop` nativo reinicia a faixa antes disso,
        // que é justamente a exceção que ele pediu. Sem próxima, `proxima()`
        // cai no close() e o player some como antes.
        onEnded={proxima}
      />

      {/* Pré-carrega a PRÓXIMA faixa enquanto a atual toca.
          Sem isto a emenda herdaria o caminho inteiro do play: /api/audio
          consulta o banco, assina a URL e só então redireciona — mediram-se
          1,7s até o primeiro byte antes de otimizar. Aqui esse custo é pago
          durante a música anterior, então a troca é imediata.
          `preload="auto"` só baixa; quem toca continua sendo o <audio> de
          cima, e este é trocado assim que a faixa vira. */}
      {proximaTrack && !repeat && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio key={proximaTrack.id} src={proximaTrack.audioUrl} preload="auto" muted />
      )}

      {/* barra fixa — só dentro de /minha-musica. Cor sólida via style (não
          a classe utilitária bg-[...]/opacidade) pra não depender de
          backdrop-filter renderizar direito em todo navegador — sem o
          filtro, a barra tem que continuar exatamente na cor do app,
          nunca ficar clara/genérica. Sem botão de fechar: o player some
          sozinho quando o cliente sai de /minha-musica; enquanto estiver
          na tela, pausar já resolve. */}
      {/* No celular a barra de abas ocupa o rodapé, então o player sobe pra
          cima dela; no desktop as abas estão no topo e ele volta pro pé. */}
      {/* text-white explícito: o player é irmão do wrapper da página, não filho
          — sem isso o título (que não tem cor própria) herda o preto do body e
          some no fundo escuro. Mesma armadilha dos modais em portal. */}
      <div
        className="fixed left-0 right-0 bottom-[var(--fm-tabbar)] sm:bottom-0 z-40 border-t border-white/10 px-4 py-2.5 text-white"
        style={{ background: "#130e1c", backdropFilter: "blur(14px)", ["--fm-tabbar" as string]: "calc(4.15rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={openFull} className="flex items-center gap-3 flex-1 min-w-0 text-left">
            <div
              className="w-10 h-10 rounded-lg flex-none bg-cover bg-center border border-white/10"
              style={track.imageUrl ? { backgroundImage: `url(${track.imageUrl})` } : { background: "linear-gradient(135deg,#3a1440,#7a1f5c)" }}
            />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{track.title}</p>
              {subtitulo && <p className="text-[11px] text-white/40 truncate">{subtitulo}</p>}
            </div>
          </button>

          {/* Apelido do autor — só quando ele existe (a maioria das faixas não
              tem: ou o dono não preencheu, ou não ligou o "mostrar na Rede").
              Traço vertical separa de propósito do título/ocasião, que ficam
              mais à esquerda. */}
          {track.apelido && (
            <div className="flex items-center gap-2.5 shrink-0 max-w-[76px] sm:max-w-[130px]">
              <span className="w-px h-6 bg-white/15 shrink-0" aria-hidden="true" />
              <p className="text-[11px] text-white/45 truncate" title={track.apelido}>{track.apelido}</p>
            </div>
          )}

          <button
            onClick={toggleRepeat}
            aria-label={repeat ? "Desativar repetir" : "Repetir música"}
            aria-pressed={repeat}
            title={repeat ? "Repetindo — toca de novo ao terminar" : "Repetir música"}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 border transition-colors ${
              repeat
                ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-200"
                : "border-white/15 text-white/45 hover:text-white/80"
            }`}
          >
            <IconRepeat />
          </button>
          <button
            onClick={anterior}
            disabled={!temAnterior}
            aria-label="Música anterior"
            title="Anterior"
            className="w-8 h-8 rounded-full items-center justify-center shrink-0 text-white/45 hover:text-white/85 disabled:opacity-25 disabled:hover:text-white/45 transition-colors hidden sm:flex"
          >
            <IconAnterior />
          </button>
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white"
            style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
            aria-label={playing ? "Pausar" : "Tocar"}
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button
            onClick={proxima}
            disabled={!temProxima}
            aria-label="Próxima música"
            title="Próxima"
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white/45 hover:text-white/85 disabled:opacity-25 disabled:hover:text-white/45 transition-colors"
          >
            <IconProxima />
          </button>
        </div>
      </div>

      {/* player cheio */}
      {fullOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center px-6 pt-6 pb-8 text-white" style={{ background: "linear-gradient(180deg, #1f1830, #0b0812)" }}>
          {/* Puxador horizontal no lugar do "▾" — estilo Spotify. Continua
              sendo um CLIQUE que fecha (não é gesto de arrastar): a área de
              toque é generosa pra não virar alvo difícil no celular. */}
          <button
            onClick={closeFull}
            aria-label="Fechar player"
            className="w-full max-w-md flex justify-center py-2 -mt-2 mb-4 group"
          >
            <span className="w-10 h-1 rounded-full bg-white/25 group-hover:bg-white/50 transition-colors" />
          </button>

          <div className="w-full max-w-md flex items-center justify-center mb-6">
            <span className="text-[11px] uppercase tracking-wide text-white/40 font-bold">Tocando agora</span>
          </div>

          <div
            className="rounded-2xl mb-5 flex-none bg-cover bg-center border border-white/10"
            style={{
              width: "min(62vw, 260px)", height: "min(62vw, 260px)",
              ...(track.imageUrl ? { backgroundImage: `url(${track.imageUrl})` } : { background: "linear-gradient(135deg,#3a1440,#7a1f5c)" }),
            }}
          />
          <h2 className="text-center text-lg font-semibold mb-1 max-w-sm" style={{ textWrap: "balance" }}>{track.title}</h2>
          <p className="text-sm text-white/40 mb-4">
            {[subtitulo, track.apelido].filter(Boolean).join(" · ") || " "}
          </p>

          {/* Favoritar e adicionar à playlist — as mesmas ações do card, pra
              quem já está ouvindo não precisar voltar pra lista.
              O coração SÓ aparece em música da Rede: na sua própria não há o
              que favoritar (o motor nem registra), e botão sem função gera
              mais dúvida do que a posição variar entre uma faixa e outra. */}
          <div className="flex items-center gap-3 mb-5 shrink-0">
            {naRede && (
              <button
                onClick={favoritar}
                aria-label={naRede.favorited ? "Remover dos favoritos" : "Favoritar"}
                className={`w-11 h-11 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
                  naRede.favorited
                    ? "border-transparent bg-pink-500/15 text-pink-400"
                    : "border-white/15 text-white/60 hover:text-white hover:border-white/35"
                }`}
              >
                <IconCoracao cheio={naRede.favorited} />
              </button>
            )}
            <button
              onClick={abrirAdicionar}
              aria-label="Adicionar esta música a uma playlist"
              className="w-11 h-11 shrink-0 rounded-full border border-white/15 text-white/60 hover:text-white hover:border-white/35 flex items-center justify-center transition-colors"
            >
              <IconMais />
            </button>
          </div>

          {lines.length > 0 && (
            <>
              {/* Selo "🎤 Letra sincronizada" removido a pedido do Audrei —
                  a letra rolando já mostra que é sincronizada. */}
              <div
                className="w-full max-w-md h-[130px] min-h-0 overflow-y-auto mb-5 px-2"
                style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)" }}
              >
                <div className="flex flex-col gap-3 text-center py-16">
                  {lines.map((line, i) => {
                    const isActive = i === activeLine
                    const isNear = Math.abs(i - activeLine) <= 1
                    return (
                      <p
                        key={i}
                        ref={isActive ? activeLineRef : undefined}
                        className="select-none transition-all duration-500 px-2"
                        style={{
                          fontSize: isActive ? "1.2rem" : isNear ? "1rem" : ".875rem",
                          fontWeight: isActive ? 700 : isNear ? 500 : 400,
                          color: isActive ? "#fff" : isNear ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.25)",
                          textShadow: isActive ? "0 0 20px rgba(236,72,153,.6)" : "none",
                        }}
                      >
                        {line}
                      </p>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          <div className="w-full max-w-md flex items-center gap-3 mb-6">
            <span className="text-[11px] text-white/40 font-mono shrink-0">{fmt(progress)}</span>
            <input
              type="range" min={0} max={duration || 0} step={0.1} value={progress}
              onChange={(e) => seek(Number(e.target.value))}
              className="flex-1 accent-pink-500 h-1 cursor-pointer"
            />
            <span className="text-[11px] text-white/40 font-mono shrink-0">{fmt(duration)}</span>
          </div>

          <button
            onClick={toggle}
            className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center"
            aria-label={playing ? "Pausar" : "Tocar"}
          >
            {playing ? <IconPause size="w-7 h-7" /> : <IconPlay size="w-7 h-7" />}
          </button>
        </div>
      )}

      {/* Modais de playlist. Ficam FORA do bloco `fullOpen` porque o player
          cheio ocupa a tela inteira com z-50 — dentro dele, o modal ficaria
          preso no mesmo contexto de empilhamento e apareceria por baixo. */}
      <AddToPlaylistModal
        open={escolhendoPlaylist}
        playlists={playlists}
        onClose={() => setEscolhendoPlaylist(false)}
        onAdd={(playlistId) => adicionarNa(playlistId)}
        onCreateNew={() => { setEscolhendoPlaylist(false); setCriandoPlaylist(true) }}
      />
      <CreatePlaylistModal
        open={criandoPlaylist}
        onClose={() => setCriandoPlaylist(false)}
        onCreate={criarPlaylist}
      />
    </>
  )
}
