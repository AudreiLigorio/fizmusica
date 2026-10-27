"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import FotosPanel from "./FotosPanel"
import type { PlanFeatures } from "@/lib/planFeatures"

type Track = { audioId: string; audioUrl: string; imageUrl: string | null; title: string | null; duration: number | null }

type StepKey = "principal" | "fotos" | "surpresa" | "player"

// Clave de sol — contorno extraído da fonte Bravura (Steinberg), licenciada
// sob a SIL Open Font License 1.1, e normalizado para um viewBox 24x24.
//
// Por que não o caractere 𝄞 (U+1D11E): ele vive no bloco de símbolos
// musicais, que falta em muitas fontes de Android — no app (TWA) viraria um
// quadradinho. E por que não a clave do sistema, que é a mais bonita no Mac:
// ela vem da Apple Symbols, proprietária, e o desenho iria parar dentro de um
// produto comercial.
//
// Fica aqui fora do componente porque é um bloco de ~1,8 KB de curvas: dentro
// da lista de abas, ele soterraria as outras três.
const CLAVE_DE_SOL = "M12.51 9.56C12.48 9.41 12.51 9.39 12.58 9.32C12.78 9.13 13.05 8.87 13.28 8.6C14.34 7.45 14.96 5.96 14.96 4.55C14.96 3.46 14.66 2.38 14.15 1.63C13.96 1.35 13.63 1 13.5 1C13.32 1 12.93 1.33 12.68 1.6C11.76 2.63 11.46 4.19 11.46 5.5C11.46 6.22 11.54 7.04 11.63 7.55C11.66 7.7 11.67 7.73 11.52 7.85C10.72 8.52 9.85 9.28 9.2 10.08C8.34 11.16 7.8 12.33 7.8 13.67C7.8 15.85 9.29 17.91 12.36 17.91C12.65 17.91 12.97 17.89 13.22 17.84C13.36 17.81 13.38 17.8 13.41 17.95C13.56 18.79 13.75 19.88 13.75 20.47C13.75 22.32 12.49 22.55 11.76 22.55C11.08 22.55 10.75 22.35 10.75 22.19C10.75 22.1 10.87 22.06 11.15 21.97C11.54 21.86 11.99 21.52 11.99 20.79C11.99 20.11 11.56 19.52 10.79 19.52C9.95 19.52 9.45 20.18 9.45 20.96C9.45 21.77 9.94 23 11.83 23C12.67 23 14.3 22.62 14.3 20.49C14.3 19.78 14.07 18.59 13.94 17.81C13.91 17.66 13.92 17.68 14.1 17.6C15.36 17.1 16.2 16.03 16.2 14.62C16.2 13.01 15.03 11.6 13.18 11.6C12.86 11.6 12.86 11.6 12.82 11.37ZM13.69 2.94C14.1 2.94 14.44 3.28 14.44 3.97C14.44 4.83 14.02 5.64 13.05 6.61C12.85 6.81 12.54 7.1 12.26 7.35C12.17 7.43 12.12 7.41 12.09 7.25C12.04 6.93 12.02 6.5 12.02 6.1C12.02 4.14 12.92 2.94 13.69 2.94ZM12.32 11.47C12.36 11.71 12.36 11.7 12.13 11.77C11.03 12.15 10.31 13.14 10.31 14.21C10.31 15.33 10.9 16.13 11.76 16.42C11.86 16.46 12.01 16.5 12.09 16.5C12.19 16.5 12.24 16.44 12.24 16.36C12.24 16.27 12.14 16.23 12.06 16.2C11.53 15.97 11.15 15.43 11.15 14.86C11.15 14.14 11.64 13.6 12.41 13.39C12.61 13.34 12.63 13.35 12.66 13.49L13.28 17.22C13.31 17.36 13.3 17.36 13.11 17.4C12.91 17.44 12.66 17.46 12.41 17.46C10.21 17.46 8.8 16.25 8.8 14.51C8.8 13.77 8.92 12.78 9.96 11.6C10.72 10.76 11.29 10.3 11.88 9.82C12.01 9.72 12.03 9.73 12.06 9.87ZM13.18 13.47C13.16 13.32 13.17 13.28 13.32 13.29C14.34 13.38 15.18 14.23 15.18 15.33C15.18 16.12 14.7 16.76 14 17.11C13.85 17.19 13.82 17.19 13.8 17.04Z"


// Estado entregue com as 2 versões do Suno. A barra de passos vira NAVEGAÇÃO:
// clicar abre o conteúdo do passo logo abaixo (um de cada vez).
// Ordem deliberada: Música → Fotos → QR Code → Player — o QR Code vem antes
// do player porque é nele que o cliente entende para que serve o QR Code.
export default function VersoesEntregues({
  orderId,
  tracks,
  principalUrl,
  slug,
  photoToken,
  photoCount,
  features,
  canRevise,
  linkAtivo = true,
  linkPrazoDias = null,
  onQr,
  onNaoGostei,
  onChanged,
}: {
  orderId: string
  tracks: Track[]
  principalUrl: string | null
  slug: string | null
  photoToken?: string | null
  photoCount?: number
  // Recursos do plano contratado: o que não estiver incluído não aparece.
  features: PlanFeatures
  canRevise?: boolean
  // false = link público vencido pelo expurgo. Ouvir e baixar continuam; QR e
  // compartilhar somem, senão o cliente divulgaria um endereço quebrado.
  linkAtivo?: boolean
  // Prazo configurado (dias). Vai no aviso pra o cliente conferir contra o
  // que contratou, em vez de só ver "expirou" sem referência.
  linkPrazoDias?: number | null
  onQr: () => void
  onNaoGostei?: () => void
  onChanged?: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [active, setActive] = useState<StepKey>("principal")
  const [verOutra, setVerOutra] = useState(false)
  const [copied, setCopied] = useState(false)

  // Ao trocar de aba, traz a barra de passos (e o conteúdo novo) pro topo da
  // tela — sem isso, se a aba anterior era mais alta, o conteúdo novo pode
  // renderizar fora da área visível.
  const rootRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    // Sem animação: no celular o teclado fechando (a pessoa acabou de editar
    // a letra) cancela a rolagem suave e o passo novo fica fora da tela.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    rootRef.current?.scrollIntoView({ block: "start" })
  }, [active])

  const hasPhotos  = (photoCount ?? 0) > 0
  const principal  = tracks.find((t) => principalUrl && t.audioUrl === principalUrl) ?? tracks[0]
  const outras     = tracks.filter((t) => t !== principal)
  const publicUrl  = slug ? `https://fizmusica.com.br/m/${slug}` : ""
  const waUrl      = `https://wa.me/?text=${encodeURIComponent(`Ouça a música que eu fiz pra você 🎵 ${publicUrl}`)}`

  async function tornarPrincipal(audioId: string) {
    setBusy(audioId); setError("")
    try {
      const res = await fetch(`/api/orders/${orderId}/musica/escolher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioId }),
      })
      const d = await res.json()
      if (!d.ok) { setError(d.error ?? "Não consegui trocar a versão principal."); setBusy(null); return }
      setVerOutra(false)
      onChanged?.()
    } catch {
      setError("Algo deu errado. Tente de novo.")
      setBusy(null)
    }
  }

  function copiarLink() {
    if (!publicUrl) return
    navigator.clipboard?.writeText(publicUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  // A barra só oferece o que o plano entrega: aba de fotos some em plano sem
  // fotos, e o QR Code some em plano sem QR.
  //
  // Rótulos nomeiam a COISA, não o papel dela (Audrei, 2026-10-27): "Música"
  // em vez de "Principal" e "QR Code" em vez de "Surpresa". "Principal" só
  // fazia sentido pra quem já sabia que existem duas versões e uma é a
  // escolhida; "Surpresa" descrevia o uso que a pessoa pretende dar, não o
  // que ela encontra ao tocar. As `key` continuam as mesmas — são estado
  // interno, e trocá-las não mudaria nada na tela.
  const steps: { key: StepKey; icon: ReactNode; label: string; done: boolean; nudge?: boolean }[] = [
    {
      key: "principal",
      // Preenchida, não traçada: é o desenho tipográfico, com a curva
      // grossa e as pontas finas — foi o que o Audrei escolheu, entre a
      // versão que eu havia desenhado à mão e esta.
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path d={CLAVE_DE_SOL} />
        </svg>
      ),
      label: "Música",
      done: true,
    },
    // Fotos somem junto com o link: o expurgo apaga os arquivos no mesmo
    // evento, e sem o player público não há mais onde elas apareceriam.
    ...(features.fotos > 0 && linkAtivo
      ? [{ key: "fotos" as const, icon: "📸", label: "Fotos", done: hasPhotos, nudge: !hasPhotos }]
      : []),
    ...(features.qrcode && linkAtivo
      ? [{
          key: "surpresa" as const,
          // SVG em vez de emoji: o rótulo virou "QR Code" e não existe emoji
          // de QR — o 🎁 era herança de quando a aba se chamava "Surpresa" e
          // passou a nomear o embrulho, não o que está dentro. Monocromático,
          // como o ✓ que ocupa este mesmo lugar nas abas concluídas.
          icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="w-4 h-4" aria-hidden="true">
              <path d="M3 3h8v8H3V3zm2 2v4h4V5H5z" />
              <path d="M13 3h8v8h-8V3zm2 2v4h4V5h-4z" />
              <path d="M3 13h8v8H3v-8zm2 2v4h4v-4H5z" />
              <path d="M13 13h3v3h-3zM18 13h3v3h-3zM13 18h3v3h-3zM18 18h3v3h-3z" />
            </svg>
          ),
          label: "QR Code",
          done: false,
        }]
      : []),
    { key: "player",    icon: "▶",  label: "Player",    done: false },
  ]

  const principalIndex = tracks.indexOf(principal)

  return (
    <div ref={rootRef} className="space-y-3">
      {/* Barra de passos — navegação "o que fazer agora" */}
      <div className={`grid gap-1.5 ${
        steps.length === 2 ? "grid-cols-2" : steps.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
        {steps.map((s) => {
          const isActive = active === s.key
          return (
            <button key={s.key} onClick={() => setActive(s.key)}
              className={`relative flex flex-col items-center justify-center rounded-xl py-2.5 px-1 border transition-colors ${
                isActive
                  ? "border-pink-500 bg-pink-500/15"
                  : s.done
                    ? "border-green-500/30 bg-green-500/10 hover:bg-green-500/15"
                    : s.nudge
                      ? "border-pink-500/50 bg-pink-500/[0.07] hover:bg-pink-500/10"
                      : "border-white/10 bg-black/20 hover:bg-white/5"
              }`}>
              {s.nudge && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[11px] font-semibold bg-pink-500 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  falta isso
                </span>
              )}
              <span className="flex items-center justify-center h-4 text-base leading-none mb-1">{s.done && !isActive ? "✓" : s.icon}</span>
              <span className={`text-[13px] font-medium leading-tight ${
                isActive ? "text-pink-100" : s.nudge ? "text-pink-200" : s.done ? "text-green-300" : "text-white/70"
              }`}>{s.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── PRINCIPAL ── só a versão escolhida; "ouvir a outra" revela pra trocar */}
      {active === "principal" && (
        <div className="space-y-3">
          <p className="text-white/60 text-sm">Ouça as versões e escolha a <strong className="text-white/80">principal</strong> — é ela que vai no QR Code e no link. {features.revisao && canRevise ? "Se nenhuma te agradou, você pode pedir para refazer." : "Você pode trocar quando quiser."}</p>

          <div className="rounded-xl border border-pink-500/40 bg-pink-500/[0.06] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/80 text-sm font-medium">
                Versão {principalIndex + 1}{principal.duration ? ` · ${Math.round(principal.duration)}s` : ""}
              </p>
              <span className="text-[13px] font-bold bg-pink-500 text-white px-2 py-0.5 rounded-full">⭐ PRINCIPAL</span>
            </div>
            <audio controls src={principal.audioUrl} className="w-full h-10" />
          </div>

          {outras.length > 0 && !verOutra && (
            <button onClick={() => setVerOutra(true)}
              className="w-full text-center py-2 rounded-lg text-sm text-white/50 hover:text-white/80 border border-white/10 hover:bg-white/5 transition-colors">
              Ouvir / trocar a versão principal ▾
            </button>
          )}

          {verOutra && outras.map((t) => (
            <div key={t.audioId} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/80 text-sm font-medium">
                  Versão {tracks.indexOf(t) + 1}{t.duration ? ` · ${Math.round(t.duration)}s` : ""}
                </p>
                <button onClick={() => tornarPrincipal(t.audioId)} disabled={busy !== null}
                  className="text-[13px] font-semibold border border-pink-500/30 text-pink-300 hover:bg-pink-500/10 disabled:opacity-50 px-2.5 py-1 rounded-lg transition-colors">
                  {busy === t.audioId ? "Trocando…" : "⭐ Tornar principal"}
                </button>
              </div>
              <audio controls src={t.audioUrl} className="w-full h-10" />
            </div>
          ))}

          {/* Saída de emergência: não gostou de nenhuma → pedir revisão. Discreto,
              separado, e só enquanto a revisão está disponível. */}
          {features.revisao && canRevise && onNaoGostei && (
            <div className="border-t border-white/[0.08] pt-3 mt-1">
              <button onClick={onNaoGostei}
                className="w-full text-center py-2.5 rounded-lg text-sm font-medium border border-white/12 text-white/45 hover:border-red-500/30 hover:text-red-400 transition-colors">
                Não gostei de nenhuma — pedir para refazer →
              </button>
              <p className="text-center text-[13px] text-white/30 mt-1.5">Você tem 1 revisão inclusa</p>
            </div>
          )}
        </div>
      )}

      {/* ── FOTOS ── embutidas; o player reflete na hora */}
      {active === "fotos" && (
        photoToken
          ? <FotosPanel token={photoToken} onChange={onChanged} />
          : <p className="text-white/50 text-sm px-1 py-4 text-center">As fotos desta música não estão disponíveis para edição.</p>
      )}

      {/* ── SURPRESA ── opcional: transformar a música em presente físico via QR */}
      {active === "surpresa" && (
        <div className="rounded-xl border border-pink-500/30 bg-pink-500/[0.06] p-4">
          {/* Sem o "Opcional —" na frente (Audrei, 2026-10-27): a frase abria
              avisando o que ela NÃO é, e o aviso vinha antes da ideia. A aba
              inteira já é opcional — quem não quer o QR simplesmente não entra
              aqui. Agora começa pelo convite.

              Logo abaixo dela havia um segundo título, "Agora a surpresa — o
              QR vira presente": dois recados seguidos dizendo a mesma coisa, e
              o segundo em destaque. Saiu também — esta frase apresenta a ideia
              e os três passos abaixo mostram como fazer. */}
          <p className="text-white/55 text-sm text-center mb-3 leading-relaxed">Surpreenda colando o QR num presente físico: uma caixa, um cartão, um quadro, um buquê ou uma lembrancinha.</p>
          {/* Passo a passo de verdade, em lista numerada — antes eram três
              ícones lado a lado com um rótulo de duas palavras ("Imprime o
              QR", "Cola no presente", "Aponta e ouve"). Numa coluna de ~100px
              não cabia explicar nada, e o terceiro passo, que é o desfecho
              inteiro da surpresa, virava "Aponta e ouve" — sem dizer que a
              pessoa vê o player com as fotos e a música tocando.

              Vertical porque instrução se lê de cima pra baixo, e porque só
              assim cada passo tem linha pra explicar o que fazer. */}
          <ol className="space-y-3 mb-4">
            {[
              { icon: "🖨️", t: "Imprima o QR Code", d: "Toque no botão abaixo para gerar e imprimir." },
              { icon: "🎁", t: "Cole no presente", d: "No presente da sua preferência — é ali que a surpresa fica escondida." },
              {
                icon: "📱",
                t: "A pessoa aponta a câmera",
                // Só promete fotos quando o plano tem fotos — mesma condição
                // do texto da aba Player, logo abaixo.
                d: `O celular abre o player com ${features.fotos > 0 ? "as suas fotos e " : "a capa e "}a música tocando.`,
              },
            ].map((m, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-pink-500/20 text-pink-200 text-[13px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white/85 leading-snug">
                    <span className="mr-1.5" aria-hidden="true">{m.icon}</span>{m.t}
                  </p>
                  <p className="text-[13px] text-white/50 leading-relaxed">{m.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <button onClick={onQr}
            className="w-full text-center py-3 rounded-lg text-sm font-bold text-white transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
            {/* 🖨️ e não 📱: o botão IMPRIME. O celular é do passo 3, de quem
                recebe — com os dois iguais, os ícones deixavam de contar a
                sequência (impressora → presente → celular). */}
            🖨️ Imprimir QR e fazer a surpresa
          </button>
        </div>
      )}

      {/* ── PLAYER ── ouvir, baixar e compartilhar */}
      {active === "player" && (
        <div className="space-y-2">
          {linkAtivo ? (
            /* Três frases curtas, uma ideia cada: o que é, quem vê, como
               mudar. O texto antigo ("Veja como ficou no player… Aqui você
               pode compartilhar o acesso a esse player exclusivo") repetia
               "exclusiv-" duas vezes, chamava o player pelo nome duas vezes e
               não dizia a parte que importa: que ESTA tela é exatamente o que
               a outra pessoa vai ver.

               As condições não são enfeite — a aba Fotos só existe em plano
               com fotos e a aba QR Code só em plano com QR. Citar uma aba que
               não está na tela manda o cliente procurar o que não há. */
            <p className="text-white/55 text-sm text-center mb-1 leading-relaxed">
              Veja como ficou: {features.fotos > 0 ? "as suas fotos e a música, sincronizadas" : "a capa e a música"}.{" "}
              É isto que a pessoa vê ao abrir o link{features.qrcode ? " ou escanear o QR Code" : ""}.{" "}
              Para mudar, use {features.fotos > 0 ? "as abas Fotos e Música" : "a aba Música"}.
            </p>
          ) : (
            /* Link vencido: explica em vez de sumir sem aviso, senão o cliente
               acha que perdeu a música — que continua aqui, ouvível e baixável. */
            <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 mb-1">
              <p className="text-sm font-semibold text-white/70 mb-1">🔒 Acesso público encerrado</p>
              <p className="text-[13px] text-white/45 leading-relaxed">
                {linkPrazoDias
                  ? `Terminou o prazo de ${linkPrazoDias} dias de link público do seu plano. `
                  : "Terminou o prazo de link público do seu plano. "}
                O QR Code, o compartilhamento e as fotos saíram do ar.{" "}
                <strong className="text-white/60">Sua música continua sua</strong> — dá pra
                ouvir aqui e baixar o MP3 quando quiser.
              </p>
            </div>
          )}
          {slug && linkAtivo && (
            <a href={`/m/${slug}`}
              className="block text-center py-3 rounded-lg text-sm font-bold text-white transition-all hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
              ▶ Ouvir no player
            </a>
          )}
          <div className={`grid gap-2 ${!linkAtivo ? "grid-cols-1" : features.download && principalUrl ? "grid-cols-3" : "grid-cols-2"}`}>
            {principalUrl && features.download && (
              <a href={`/api/orders/${orderId}/musica/download`} download
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-[13px] font-semibold border border-white/15 text-white/75 hover:bg-white/5 transition-colors">
                <span className="text-base leading-none">⬇</span> Baixar
              </a>
            )}
            {linkAtivo && (
              <>
                <button onClick={copiarLink}
                  className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-[13px] font-semibold border border-white/15 text-white/75 hover:bg-white/5 transition-colors">
                  <span className="text-base leading-none">🔗</span> {copied ? "Copiado!" : "Copiar link"}
                </button>
                <a href={waUrl} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-[13px] font-semibold border border-green-500/30 text-green-300 hover:bg-green-500/10 transition-colors">
                  <span className="text-base leading-none">💬</span> WhatsApp
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
