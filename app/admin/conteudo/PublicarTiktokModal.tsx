"use client"

import { useEffect, useRef, useState } from "react"

// Tela de publicação do TikTok.
//
// Ela não existe por capricho de UX: as diretrizes de compartilhamento do
// TikTok são parte do App Review, e exigem, antes de qualquer post, que o app
// mostre de qual conta o vídeo vai sair, deixe a pessoa ESCOLHER a privacidade
// (sem valor padrão), ofereça comentário/dueto/costura DESMARCADOS, respeite o
// que a conta já bloqueou, colete a declaração de conteúdo comercial e exiba o
// texto de consentimento. Título pré-preenchido que não dá pra editar também é
// proibido — por isso a legenda gerada pela IA vem editável aqui.
//
// Doc: https://developers.tiktok.com/doc/content-sharing-guidelines

export type CreatorInfo = {
  creator_username: string
  creator_nickname: string
  creator_avatar_url: string
  privacy_level_options: string[]
  max_video_post_duration_sec: number
  comment_disabled: boolean
  duet_disabled: boolean
  stitch_disabled: boolean
}

export type OpcoesTiktok = {
  privacyLevel: string
  allowComment: boolean
  allowDuet: boolean
  allowStitch: boolean
  brandOrganic: boolean
  brandedContent: boolean
  title: string
}

const NOME_PRIVACIDADE: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Público — todo mundo",
  MUTUAL_FOLLOW_FRIENDS: "Amigos (seguidores mútuos)",
  FOLLOWER_OF_CREATOR: "Seguidores",
  SELF_ONLY: "Só eu (privado)",
}

const MUSIC_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
const BC_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en"

const TITULO_MAX = 2200

// Enum de privacidade da própria documentação do TikTok. Usado só no modo
// prévia (antes da Content Posting API ser aprovada), pra tela demonstrar a
// seleção obrigatória. A lista de verdade — que depende de a conta ser pública
// ou privada — vem do creator_info e substitui esta assim que o escopo existir.
const OPCOES_DOC = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"]

export default function PublicarTiktokModal({
  draftId, videoUrl, captionInicial, onFechar, onPublicado,
}: {
  draftId: string
  videoUrl: string
  captionInicial: string
  onFechar: () => void
  onPublicado: (nota?: string) => void
}) {
  const [creator, setCreator] = useState<CreatorInfo | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [erroCreator, setErroCreator] = useState<string | null>(null)
  const [publicando, setPublicando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Sem valor inicial: a diretriz é explícita — a privacidade tem que ser
  // escolhida, não herdada de um padrão nosso.
  const [privacidade, setPrivacidade] = useState("")
  const [comentario, setComentario] = useState(false)
  const [dueto, setDueto] = useState(false)
  const [costura, setCostura] = useState(false)
  const [comercial, setComercial] = useState(false)
  const [marcaPropria, setMarcaPropria] = useState(false)
  const [parceriaPaga, setParceriaPaga] = useState(false)
  const [titulo, setTitulo] = useState(captionInicial.slice(0, TITULO_MAX))
  const [duracao, setDuracao] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    fetch(`/api/admin/conteudo/${draftId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "tiktok_creator_info" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return setErroCreator(d.error)
        setCreator(d.creator)
        if (d.previa) setPrevia(d.motivo ?? "Escopo de publicação ainda não autorizado.")
      })
      .catch(() => setErroCreator("Não consegui falar com o TikTok agora."))
  }, [draftId])

  // Parceria paga não pode ser privada: a plataforma proíbe. Se já estava em
  // "só eu", limpa a escolha em vez de publicar algo que seria recusado.
  useEffect(() => {
    if (parceriaPaga && privacidade === "SELF_ONLY") setPrivacidade("")
  }, [parceriaPaga, privacidade])

  const opcoesPrivacidade = previa ? OPCOES_DOC : creator?.privacy_level_options ?? []
  const duracaoExcedida =
    !!creator && !previa && duracao !== null && duracao > creator.max_video_post_duration_sec

  const faltaDeclararComercial = comercial && !marcaPropria && !parceriaPaga
  const podeEnviar =
    !!creator && !previa && !!privacidade && !!titulo.trim() && !faltaDeclararComercial && !duracaoExcedida && !publicando

  const rotuloComercial = parceriaPaga
    ? "Your video will be labeled as “Paid partnership”"
    : marcaPropria
      ? "Your video will be labeled as “Promotional content”"
      : null

  async function publicar() {
    setPublicando(true); setErro(null)
    const opcoes: OpcoesTiktok = {
      privacyLevel: privacidade,
      allowComment: comentario,
      allowDuet: dueto,
      allowStitch: costura,
      brandOrganic: marcaPropria,
      brandedContent: parceriaPaga,
      title: titulo.trim(),
    }
    try {
      const d = await fetch(`/api/admin/conteudo/${draftId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publicar", opcoesTiktok: opcoes }),
      }).then((r) => r.json())
      if (d.ok) onPublicado(d.nota ?? undefined)
      else setErro(d.error)
    } catch {
      setErro("Falha ao publicar.")
    } finally {
      setPublicando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4"
      onClick={onFechar}>
      <div className="w-full max-w-lg my-8 rounded-2xl border border-white/10 bg-[#0d0b16] p-5"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-white font-semibold">Publicar no TikTok</h3>
            {creator ? (
              // Exigência: deixar claro em QUAL conta o vídeo vai sair.
              <p className="text-white/50 text-xs mt-0.5 flex items-center gap-1.5">
                {creator.creator_avatar_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={creator.creator_avatar_url} alt="" className="w-5 h-5 rounded-full" />
                )}
                Vai para <span className="text-white/80">{creator.creator_nickname}</span>
                {creator.creator_username && `(@${creator.creator_username})`}
              </p>
            ) : (
              <p className="text-white/40 text-xs mt-0.5">Carregando dados da conta…</p>
            )}
          </div>
          <button onClick={onFechar} className="text-white/40 hover:text-white/80 text-lg leading-none">×</button>
        </div>

        {previa && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-amber-300 text-xs font-semibold">Prévia da tela de publicação</p>
            <p className="text-amber-300/80 text-[11px] mt-1">{previa}</p>
            <p className="text-amber-300/60 text-[11px] mt-1">
              As privacidades listadas abaixo são as da documentação; a lista real da conta (e o limite de
              duração) vem do creator_info assim que o escopo estiver ativo. Publicar segue desativado até lá.
            </p>
          </div>
        )}

        {erroCreator && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-amber-300 text-xs">{erroCreator}</p>
          </div>
        )}

        <video ref={videoRef} src={videoUrl} controls playsInline
          onLoadedMetadata={(e) => setDuracao(e.currentTarget.duration)}
          className="w-full max-h-64 rounded-lg bg-black mb-3" />
        {duracao !== null && (
          <p className={`text-xs mb-3 ${duracaoExcedida ? "text-red-400" : "text-white/40"}`}>
            Duração {duracao.toFixed(0)}s
            {/* O limite é por conta e vem do creator_info — em prévia não temos,
                e mostrar "limite: 0s" pareceria vídeo reprovado. */}
            {!previa && creator ? ` — limite desta conta: ${creator.max_video_post_duration_sec}s` : ""}
            {duracaoExcedida && " · vídeo longo demais para publicar por aqui."}
          </p>
        )}

        <label className="block text-white/70 text-xs mb-1">Legenda (editável)</label>
        <textarea value={titulo} onChange={(e) => setTitulo(e.target.value.slice(0, TITULO_MAX))}
          rows={4}
          className="w-full text-sm bg-black/40 border border-white/10 rounded-lg p-2 text-white/90 mb-1" />
        <p className="text-white/30 text-[11px] mb-4">{titulo.length}/{TITULO_MAX}</p>

        <label className="block text-white/70 text-xs mb-1">Quem pode ver *</label>
        <select value={privacidade} onChange={(e) => setPrivacidade(e.target.value)}
          className="w-full text-sm bg-black/40 border border-white/10 rounded-lg p-2 text-white/90 mb-4">
          <option value="">Selecione…</option>
          {opcoesPrivacidade.map((p) => {
            const bloqueadoPorParceria = parceriaPaga && p === "SELF_ONLY"
            return (
              <option key={p} value={p} disabled={bloqueadoPorParceria}
                title={bloqueadoPorParceria ? "Branded content visibility cannot be set to private" : undefined}>
                {NOME_PRIVACIDADE[p] ?? p}{bloqueadoPorParceria ? " — indisponível para parceria paga" : ""}
              </option>
            )
          })}
        </select>

        <p className="text-white/70 text-xs mb-2">Interações</p>
        <div className="space-y-1.5 mb-4">
          {[
            { label: "Permitir comentários", v: comentario, set: setComentario, off: creator?.comment_disabled },
            { label: "Permitir dueto", v: dueto, set: setDueto, off: creator?.duet_disabled },
            { label: "Permitir costura (stitch)", v: costura, set: setCostura, off: creator?.stitch_disabled },
          ].map((it) => (
            <label key={it.label}
              className={`flex items-center gap-2 text-xs ${it.off ? "text-white/25 cursor-not-allowed" : "text-white/70"}`}
              title={it.off ? "Desativado nas configurações da conta no TikTok" : undefined}>
              <input type="checkbox" checked={it.v} disabled={it.off}
                onChange={(e) => it.set(e.target.checked)} />
              {it.label}{it.off && " (bloqueado na conta)"}
            </label>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-white/70 mb-2">
          <input type="checkbox" checked={comercial}
            onChange={(e) => { setComercial(e.target.checked); if (!e.target.checked) { setMarcaPropria(false); setParceriaPaga(false) } }} />
          Divulgar conteúdo comercial
        </label>
        {comercial && (
          <div className="ml-5 space-y-1.5 mb-2">
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input type="checkbox" checked={marcaPropria} onChange={(e) => setMarcaPropria(e.target.checked)} />
              Your Brand — promovo minha própria marca
            </label>
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input type="checkbox" checked={parceriaPaga} onChange={(e) => setParceriaPaga(e.target.checked)} />
              Branded Content — parceria paga com outra marca
            </label>
            {rotuloComercial && <p className="text-white/50 text-[11px]">{rotuloComercial}</p>}
            {faltaDeclararComercial && (
              <p className="text-amber-400 text-[11px]">Escolha pelo menos uma opção para publicar.</p>
            )}
          </div>
        )}

        {/* Texto de consentimento exigido pela plataforma, na forma que ela pede. */}
        <p className="text-white/40 text-[11px] mb-4">
          {parceriaPaga ? (
            <>By posting, you agree to TikTok&apos;s{" "}
              <a href={BC_URL} target="_blank" rel="noreferrer" className="underline hover:text-white/70">Branded Content Policy</a>{" "}
              and <a href={MUSIC_URL} target="_blank" rel="noreferrer" className="underline hover:text-white/70">Music Usage Confirmation</a>.</>
          ) : (
            <>By posting, you agree to TikTok&apos;s{" "}
              <a href={MUSIC_URL} target="_blank" rel="noreferrer" className="underline hover:text-white/70">Music Usage Confirmation</a>.</>
          )}
        </p>

        {erro && <p className="text-red-400 text-xs mb-3">❌ {erro}</p>}

        <div className="flex items-center justify-end gap-2">
          <button onClick={onFechar} className="text-xs px-3 py-1.5 rounded-lg border border-white/15 text-white/70 hover:bg-white/5">
            Cancelar
          </button>
          <button onClick={publicar} disabled={!podeEnviar}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
            {publicando ? "publicando…" : previa ? "📤 Publicar (aguardando aprovação)" : "📤 Publicar no TikTok"}
          </button>
        </div>
      </div>
    </div>
  )
}
