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

  // Bottom sheet da letra, mesmo mecanismo do player do pedido: fechado
  // mostra os controles; aberto, a letra ocupa a tela. Volta a fechar
  // sempre que o player cheio some, senão ele reabriria já expandido na
  // próxima música.
  const [sheetOpen, setSheetOpen] = useState(false)
  const sheetTouchY = useRef<number | null>(null)
  useEffect(() => { if (!fullOpen) setSheetOpen(false) }, [fullOpen])
  function onSheetTouchStart(e: React.TouchEvent) { sheetTouchY.current = e.touches[0].clientY }
  function onSheetTouchEnd(e: React.TouchEvent) {
    if (sheetTouchY.current === null) return
    const dy = e.changedTouches[0].clientY - sheetTouchY.current
    if (dy < -30) setSheetOpen(true)
    else if (dy > 30) setSheetOpen(false)
    sheetTouchY.current = null
  }

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
  //
  // `fullOpen`/`sheetOpen` nas dependências CONSERTAM um bug: antes só
  // `activeLine` entrava, então quem abria o player no meio da música
  // (a linha ativa já estava definida, não mudava) via a caixa parada no
  // topo — 64px de padding e as primeiras linhas a 25% de opacidade atrás
  // da máscara. Lia como "a letra não carregou", mas ela estava lá, fora
  // de vista. Era o caso do print: música de 38 linhas sincronizadas, aos
  // 1:38, caixa aparentemente vazia.
  //
  // Instantâneo na primeira vez (pular 30 linhas com animação fica
  // esquisito) e suave depois, que é o acompanhamento normal da música.
  //
  // NÃO usar scrollIntoView aqui, por mais natural que pareça: ele rola
  // TODOS os ancestrais roláveis até a linha aparecer — e `overflow-hidden`
  // não impede rolagem por script, só a do dedo. Como a letra mora dentro
  // do sheet, que está deslocado pra baixo, o navegador "consertava" isso
  // rolando a camada inteira 530px pra cima: a capa, o título e o botão de
  // voltar sumiam da tela. Medido, não suposto.
  //
  // Rolar o scrollTop da própria caixa não toca em mais nada.
  const jaRolou = useRef(false)
  const caixaLetraRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!fullOpen) { jaRolou.current = false; return }
    const t = setTimeout(() => {
      const caixa = caixaLetraRef.current
      const linha = activeLineRef.current
      if (!caixa || !linha) return
      const c = caixa.getBoundingClientRect()
      const l = linha.getBoundingClientRect()
      const alvo = caixa.scrollTop + (l.top - c.top) - (c.height / 2 - l.height / 2)
      caixa.scrollTo({ top: alvo, behavior: jaRolou.current ? "smooth" : "auto" })
      jaRolou.current = true
    }, 60)
    return () => clearTimeout(t)
  }, [activeLine, fullOpen, sheetOpen])

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

      {/* ===================== PLAYER CHEIO =====================
          Mesmo molde do player do pedido (/m/[slug]): chevron de voltar no
          canto, capa no meio, bottom sheet com a letra.

          A premissa que muda: LÁ o fundo são as fotos do cliente. Aqui não
          há fotos — a música é de outra pessoa e o slug (a chave das fotos)
          não sai da API de propósito. Então o fundo é a PRÓPRIA CAPA
          borrada, que é o que os streamings fazem quando não existe vídeo:
          dá imersão sem inventar conteúdo que não temos.

          O layout antigo era uma coluna rígida sem rolagem, e a caixa da
          letra era o único item que encolhia — numa tela de ~683px ela
          absorvia toda a sobra e virava uma faixa vazia. Aqui a letra mora
          no sheet, que tem rolagem própria: ela não disputa altura com
          mais nada. */}
      {fullOpen && (
        <div className="fixed inset-0 z-50 text-white overflow-hidden" style={{ background: "#0b0812" }}>
          {/* Fundo ambiente. `scale` esconde as bordas que o blur deixa
              translúcidas; sem ele aparece uma moldura clara na volta. */}
          {track.imageUrl && (
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${track.imageUrl})`,
                backgroundSize: "cover", backgroundPosition: "center",
                filter: "blur(44px) saturate(1.5)", transform: "scale(1.25)", opacity: 0.55,
              }}
            />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(11,8,18,.45) 0%, rgba(11,8,18,.72) 42%, #0b0812 100%)" }}
          />

          {/* Voltar. Aqui ele FECHA a camada e a música segue tocando na
              barra de baixo — não é navegação, ao contrário do player do
              pedido, que sai da página. Mesmo gesto, mesma posição. */}
          <button
            onClick={closeFull}
            aria-label="Fechar player"
            className="absolute top-8 left-4 z-30 w-10 h-10 rounded-full flex items-center justify-center bg-black/35 backdrop-blur text-white/85 hover:text-white hover:bg-black/55 transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* Capa e identificação. `bottom-[168px]` reserva a altura do sheet
              fechado e `justify-center` centraliza no que sobra, então esta
              área nunca estoura: em tela curta a capa encolhe (aspect-ratio
              com maxHeight) em vez de espremer o vizinho. */}
          <div className="absolute inset-x-0 top-0 bottom-[168px] z-10 flex flex-col items-center justify-center px-8 text-center">
            <span className="text-[11px] uppercase tracking-wide text-white/40 font-bold mb-5">Tocando agora</span>

            <div
              className="rounded-2xl bg-cover bg-center border border-white/10 shadow-2xl mb-5"
              style={{
                width: "min(62vw, 250px)", aspectRatio: "1", maxHeight: "36dvh",
                ...(track.imageUrl
                  ? { backgroundImage: `url(${track.imageUrl})` }
                  : { background: "linear-gradient(135deg,#3a1440,#7a1f5c)" }),
              }}
            />

            <h2 className="text-lg font-semibold max-w-sm" style={{ textWrap: "balance" }}>{track.title}</h2>
            <p className="text-sm text-white/40 mt-1 max-w-sm truncate">
              {[subtitulo, track.apelido].filter(Boolean).join(" · ") || " "}
            </p>

            {/* Favoritar e playlist ficam FORA do sheet de propósito: são as
                ações próprias da Rede e têm que estar a um toque, sem obrigar
                a abrir a letra. O coração só existe em música da Rede — na
                sua própria não há o que favoritar (o motor nem registra). */}
            <div className="flex items-center gap-3 mt-5">
              {naRede && (
                <button
                  onClick={favoritar}
                  aria-label={naRede.favorited ? "Remover dos favoritos" : "Favoritar"}
                  className={`w-11 h-11 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
                    naRede.favorited
                      ? "border-transparent bg-pink-500/15 text-pink-400"
                      : "border-white/15 bg-black/20 text-white/60 hover:text-white hover:border-white/35"
                  }`}
                >
                  <IconCoracao cheio={naRede.favorited} />
                </button>
              )}
              <button
                onClick={abrirAdicionar}
                aria-label="Adicionar esta música a uma playlist"
                className="w-11 h-11 shrink-0 rounded-full border border-white/15 bg-black/20 text-white/60 hover:text-white hover:border-white/35 flex items-center justify-center transition-colors"
              >
                <IconMais />
              </button>
            </div>
          </div>

          {/* ===================== BOTTOM SHEET — a letra =====================
              Fechado mostra 168px: puxador, controles e progresso. Aberto, a
              letra toma a tela. Rolagem só na área da letra (`flex-1
              min-h-0 overflow-y-auto`), o resto é fixo. */}
          <div
            className="absolute left-0 right-0 bottom-0 z-20 h-[86dvh] rounded-t-3xl border-t border-white/10 transition-transform duration-300 ease-out flex flex-col"
            style={{
              background: "linear-gradient(180deg, rgba(22,12,32,0.92) 0%, rgba(10,9,18,0.985) 40%)",
              backdropFilter: "blur(18px)",
              transform: sheetOpen ? "translateY(0)" : "translateY(calc(100% - 168px))",
            }}
            onTouchStart={onSheetTouchStart}
            onTouchEnd={onSheetTouchEnd}
          >
            {/* O sheet é largo (vai de ponta a ponta), mas o CONTEÚDO não
                pode ser: num monitor de 1280px a barra de progresso e a
                letra atravessavam a tela inteira. Uma coluna só, centrada. */}
            <div className="w-full max-w-2xl mx-auto flex flex-col flex-1 min-h-0">
            <button
              onClick={() => setSheetOpen((v) => !v)}
              aria-label={sheetOpen ? "Fechar letra" : "Abrir letra"}
              className="w-full pt-3 pb-1 flex flex-col items-center shrink-0"
            >
              <span className="w-10 h-1.5 rounded-full bg-white/40" />
              <span className="text-[11px] text-white/50 mt-1.5">
                {sheetOpen ? "arraste para baixo" : "arraste para cima"}
              </span>
            </button>

            {/* Controles. Repetir e anterior/próxima moram aqui porque a
                Rede toca em FILA — o player do pedido não tem fila e por
                isso não tem esses botões. */}
            <div className="shrink-0 flex items-center justify-center gap-5 px-6 py-2">
              <button
                onClick={toggleRepeat}
                aria-label={repeat ? "Desativar repetir" : "Repetir música"}
                aria-pressed={repeat}
                className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
                  repeat ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-200" : "border-white/15 text-white/45 hover:text-white/80"
                }`}
              >
                <IconRepeat />
              </button>
              <button
                onClick={anterior}
                disabled={!temAnterior}
                aria-label="Música anterior"
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/55 hover:text-white disabled:opacity-25 transition-colors"
              >
                <IconAnterior />
              </button>
              <button
                onClick={toggle}
                className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shrink-0"
                aria-label={playing ? "Pausar" : "Tocar"}
              >
                {playing ? <IconPause size="w-6 h-6" /> : <IconPlay size="w-6 h-6" />}
              </button>
              <button
                onClick={proxima}
                disabled={!temProxima}
                aria-label="Próxima música"
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/55 hover:text-white disabled:opacity-25 transition-colors"
              >
                <IconProxima />
              </button>
              <span className="w-9 h-9" aria-hidden="true" />
            </div>

            <div className="shrink-0 flex items-center gap-3 px-6 pt-1">
              <span className="text-[11px] text-white/40 font-mono shrink-0">{fmt(progress)}</span>
              <input
                type="range" min={0} max={duration || 0} step={0.1} value={progress}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Posição da música"
                className="flex-1 accent-pink-500 h-1 cursor-pointer"
              />
              <span className="text-[11px] text-white/40 font-mono shrink-0">{fmt(duration)}</span>
            </div>

            {/* Letra — a ÚNICA área que rola. */}
            <div
              ref={caixaLetraRef}
              className="flex-1 min-h-0 overflow-y-auto px-6 py-4"
              style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)" }}
            >
              {lines.length > 0 ? (
                <div className="flex flex-col gap-3 text-center py-10">
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
              ) : (
                // 10% do catálogo não tem letra publicada. Dizer isso é melhor
                // do que uma área vazia, que lia como falha de carregamento.
                <p className="text-center text-sm text-white/30 py-10">
                  Esta música não tem letra publicada.
                </p>
              )}
            </div>

            {/* Rodapé fixo. */}
            <div
              className="shrink-0 px-6 pt-3 border-t border-white/10"
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              <a
                href="/criar"
                className="block text-center py-3 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
              >
                Criar a minha música
              </a>
            </div>
            </div>
          </div>
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
