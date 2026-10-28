"use client"

import { useEffect, useState } from "react"
import { blocosMarcados, inserirBloco, semBlocos } from "@/lib/blocosEstrutura"
import { LIMITE_LETRA, medirLetra, excessoEstaNasInstrucoes } from "@/lib/suno/limites"
import TituloMusica from "./TituloMusica"

type State = {
  lyricsDraft: string | null
  lyricsApproved: boolean
  reprocessLeft: number
  reprocessUsed: number
  rejection: string | null
}

type Busy = "gerar" | "reprocessar" | "aprovar" | null

function friendlyError(msg: string): string {
  if (/503|overloaded|unavailable/i.test(msg)) return "A IA está sobrecarregada agora. Tente de novo em alguns minutos."
  if (/429|quota|rate/i.test(msg)) return "Limite de uso atingido. Tente de novo em alguns minutos."
  if (/timeout|timed out/i.test(msg)) return "A geração demorou demais. Tente novamente."
  if (/não retornou|empty/i.test(msg)) return "A IA não conseguiu gerar a letra. Tente novamente."
  return "Algo deu errado. Tente de novo em instantes."
}

async function readStream(
  res: Response,
  onChunk: (text: string) => void,
): Promise<{ error?: string; meta?: Record<string, unknown> }> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Extrai marcadores especiais (\x00ERR: e \x00META:) do final do buffer
    const errIdx = buffer.indexOf("\x00ERR:")
    if (errIdx !== -1) {
      const text = buffer.slice(0, errIdx)
      if (text) onChunk(text)
      return { error: buffer.slice(errIdx + 5) }
    }
    const metaIdx = buffer.indexOf("\x00META:")
    if (metaIdx !== -1) {
      const text = buffer.slice(0, metaIdx)
      if (text) onChunk(text)
      try { return { meta: JSON.parse(buffer.slice(metaIdx + 6)) } } catch { return {} }
    }
    onChunk(buffer)
    buffer = ""
  }
  return {}
}

export default function LetraPanel({
  orderId,
  onApproved,
  flowMode,
  onState,
  onEditor,
}: {
  orderId: string
  onApproved?: () => void
  flowMode?: boolean
  onState?: (s: { lyrics: string; canApprove: boolean }) => void
  // Entrega o setter da letra pra quem monta este painel.
  //
  // Existe por causa dos blocos de estrutura: marcar "solo de guitarra"
  // precisa ESCREVER na letra, e a letra mora aqui. Sem essa ponte, o card
  // teria uma cópia própria do texto e as duas divergiriam — o cliente veria
  // uma letra na tela e outra seria enviada pra geração.
  onEditor?: (api: { setText: (t: string) => void }) => void
}) {
  const [state, setState]   = useState<State | null>(null)
  const [text, setText]     = useState("")
  const [lastAiText, setLastAiText] = useState("")
  const [instrucao, setInstrucao] = useState("")
  const [titulo, setTitulo] = useState("")
  const [loading, setLoading] = useState(true)

  // Uma vez só: `setText` é estável (vem do useState), então não recria a
  // ponte a cada render.
  useEffect(() => { onEditor?.({ setText }) }, [onEditor])
  const [busy, setBusy]     = useState<Busy>(null)
  const [error, setError]   = useState("")
  const [confirmCfg, setConfirmCfg] = useState<{ title: string; message: string; confirmLabel: string; resolve: (v: boolean) => void } | null>(null)

  function askConfirm(cfg: { title: string; message: string; confirmLabel: string }): Promise<boolean> {
    return new Promise((resolve) => setConfirmCfg({ ...cfg, resolve }))
  }

  async function loadState() {
    try {
      const d = await fetch(`/api/orders/${orderId}/letra`).then((r) => r.json())
      if (d.error) return
      setState({
        lyricsDraft: d.lyricsDraft,
        lyricsApproved: d.lyricsApproved,
        reprocessLeft: d.reprocessLeft,
        reprocessUsed: d.reprocessUsed,
        rejection: d.rejection ?? null,
      })
      if (d.lyricsDraft && !text) { setText(d.lyricsDraft); setLastAiText(d.lyricsDraft) }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadState() }, [orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Modo fluxo: informa o pai (página) a letra atual + se já pode aprovar.
  useEffect(() => {
    if (!flowMode || !onState || !state) return
    const has = !!text.trim()
    // Basta TER letra. Editar à mão não trava mais o avanço — ver `podeAprovar`.
    onState({ lyrics: text, canApprove: has })
  }, [text, lastAiText, state, flowMode]) // eslint-disable-line react-hooks/exhaustive-deps

  async function gerar() {
    setBusy("gerar"); setError(""); setText("")
    try {
      const res = await fetch(`/api/orders/${orderId}/letra/gerar`, { method: "POST" })
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}))
        setError(friendlyError(d.error ?? ""))
        return
      }
      let accumulated = ""
      const { error: streamErr } = await readStream(res, (chunk) => {
        accumulated += chunk
        setText(accumulated)
      })
      if (streamErr) { setError(friendlyError(streamErr)); setText("") ; return }
      setLastAiText(accumulated.trim())
      await loadState()
    } catch {
      setError("Não consegui gerar agora. Tente de novo em instantes.")
    } finally {
      setBusy(null)
    }
  }

  async function reprocessar() {
    if (state && state.reprocessLeft === 1) {
      const ok = await askConfirm({
        title: "Última revisão",
        message: "Esta é sua última revisão com a IA. Após isso, não será possível pedir mais alterações automáticas — você poderá apenas aprovar a letra. Deseja continuar?",
        confirmLabel: "Sim, revisar",
      })
      if (!ok) return
    }
    // A revisão reescreve a letra inteira e leva as marcações junto. Guardamos
    // o que estava marcado pra devolver depois: o cliente escolheu um solo, não
    // pediu pra cancelá-lo ao ajustar um verso.
    const marcados = blocosMarcados(text)
    setBusy("reprocessar"); setError("")
    try {
      const res = await fetch(`/api/orders/${orderId}/letra/reprocessar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: text, instrucao }),
      })
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}))
        setError(friendlyError(d.error ?? ""))
        return
      }
      let accumulated = ""
      const { error: streamErr, meta } = await readStream(res, (chunk) => {
        accumulated += chunk
        setText(accumulated)
      })
      if (streamErr) { setError(friendlyError(streamErr)); return }
      // `lastAiText` fica com a saída CRUA da IA e o texto com os blocos de
      // volta — assim os dois continuam iguais aos olhos de `editado`.
      const limpo = accumulated.trim()
      setLastAiText(limpo)
      if (marcados.length) setText(marcados.reduce((t, tag) => inserirBloco(t, tag), limpo))
      setInstrucao("")
      if (meta && state) {
        setState({ ...state, reprocessLeft: (meta.reprocessLeft as number) ?? state.reprocessLeft, reprocessUsed: (meta.reprocessUsed as number) ?? state.reprocessUsed })
      } else {
        await loadState()
      }
    } catch {
      setError("Não consegui revisar agora. Tente de novo em instantes.")
    } finally {
      setBusy(null)
    }
  }

  async function aprovar() {
    if (state && state.reprocessLeft > 0) {
      const ok = await askConfirm({
        title: "Aprovar a letra?",
        message: "Após a aprovação não será possível fazer alterações. Quer aprovar esta letra para a produção da música?",
        confirmLabel: "Aprovar letra",
      })
      if (!ok) return
    }
    setBusy("aprovar"); setError("")
    try {
      const res = await fetch(`/api/orders/${orderId}/letra/aprovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: text, musicName: titulo }),
      })
      const d = await res.json()
      if (d.error) { setError(friendlyError(d.error)); return }
      await loadState(); onApproved?.()
    } catch {
      setError("Não consegui aprovar agora. Tente de novo.")
    } finally {
      setBusy(null)
    }
  }

  if (loading || !state) return null

  if (state.lyricsApproved) {
    return (
      <div className="rounded-xl border border-green-500/25 bg-green-500/8 px-4 py-3 mb-4">
        <p className="text-green-300 text-sm font-semibold">✅ Letra aprovada</p>
        <p className="text-green-400/70 text-sm">Sua letra está salva. A produção da sua música começa agora.</p>
      </div>
    )
  }

  const hasLyrics = !!text.trim()
  const semRevisoes = state.reprocessLeft <= 0
  // Medida do campo em três números (total, cantada, instruções). O total é o
  // que o fornecedor conta; a separação é o que diz ONDE cortar — ver
  // `medirLetra`.
  const medida = medirLetra(text)
  const nn = (v: number) => v.toLocaleString("pt-BR")
  // Compara SEM as marcações de bloco: marcar um solo é escolha de arranjo,
  // não edição de verso (ver semBlocos).
  const editado = semBlocos(text) !== semBlocos(lastAiText)

  // Basta ter letra. Era `!editado || semRevisoes`: quem editasse à mão ficava
  // impedido de avançar enquanto tivesse revisão sobrando, e o único botão
  // vivo era "Pedir revisão à IA" — que REESCREVE a letra inteira. Ou seja,
  // quem trouxesse a própria letra pronta caía num beco cujo único caminho
  // destruía o que ela escreveu.
  //
  // A regra também se contradizia: se letra editada à mão fosse arriscada
  // para a produção, seria arriscada igualmente com 0 revisões restantes — e
  // ali ela passava direto. O portão não garantia qualidade, só adiava, e
  // cobrava uma chamada de IA por isso.
  const podeAprovar = hasLyrics

  return (
    <>
    {confirmCfg && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={() => { confirmCfg.resolve(false); setConfirmCfg(null) }}>
        <div onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl border border-fuchsia-500/30 bg-[#1a0f24] p-6 shadow-2xl">
          <p className="text-white font-semibold text-base mb-2">{confirmCfg.title}</p>
          <p className="text-white/60 text-sm leading-relaxed mb-5">{confirmCfg.message}</p>
          <div className="flex gap-3">
            <button
              onClick={() => { confirmCfg.resolve(false); setConfirmCfg(null) }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/70 border border-white/15 hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => { confirmCfg.resolve(true); setConfirmCfg(null) }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
            >
              {confirmCfg.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    )}
    {/* A letra voltou porque o estúdio de IA recusou. Sem esta explicação o
        pedido reapareceria como "aprove sua letra" do nada, e a pessoa acharia
        que o site desfez o que ela já tinha feito.

        Não mostramos "o trecho recusado" porque o fornecedor não informa qual
        é — a resposta dele é só "contém material protegido". Pedir "altere o
        trecho" viraria adivinhação: olhar a letra inteira sem saber o que
        mudar, tentar de novo e ser recusado outra vez. */}
    {state.rejection === "letra_longa" && (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-5 mb-4">
        <p className="text-amber-200 font-semibold">
          {excessoEstaNasInstrucoes(medida)
            ? "⚠️ São as instruções que não couberam"
            : "⚠️ Sua letra ficou longa demais"}
        </p>

        {/* DUAS EXPLICAÇÕES, porque o conserto é diferente.
            Quando os versos caberiam sozinhos, o excesso está no briefing
            entre colchetes — e a versão antiga desta caixa dizia "encurte os
            versos que menos importam", mandando a pessoa cortar exatamente a
            parte que estava certa. */}
        {excessoEstaNasInstrucoes(medida) ? (
          <>
            <p className="text-white/70 text-sm mt-1.5 leading-relaxed">
              Os seus versos têm <strong className="text-white/85">{nn(medida.cantada)}</strong> caracteres
              e cabem bem. Só que as instruções entre colchetes somam
              outros <strong className="text-amber-200">{nn(medida.instrucoes)}</strong>,
              e o estúdio de IA conta tudo junto: {nn(medida.total)} de um limite
              de {nn(LIMITE_LETRA)}.
            </p>
            <p className="text-white/70 text-sm mt-3 leading-relaxed">
              Encurte as instruções — tire as que se repetem e deixe só as
              marcações de estrutura, como <span className="text-white/50">[Refrão]</span> e <span className="text-white/50">[Ponte]</span> —
              e aprove de novo. <strong className="text-white/85">Os versos podem ficar como estão.</strong> Seu
              pedido continua pago e garantido.
            </p>
          </>
        ) : (
          <>
            <p className="text-white/70 text-sm mt-1.5 leading-relaxed">
              O estúdio de IA aceita no máximo {nn(LIMITE_LETRA)} caracteres,
              e a sua passou disso — por isso a música não chegou a ser gravada.
              {medida.total > 0 && (
                <> A letra aqui embaixo está com{" "}
                  <strong className="text-white/85">{nn(medida.total)}</strong>
                  {medida.instrucoes > 0 && <> ({nn(medida.cantada)} de versos e {nn(medida.instrucoes)} de instruções entre colchetes)</>}.
                  {medida.total > LIMITE_LETRA && (
                    <> Falta tirar cerca de{" "}
                      <strong className="text-amber-200">{nn(medida.total - LIMITE_LETRA)}</strong>.</>
                  )}
                </>
              )}
            </p>
            <p className="text-white/70 text-sm mt-3 leading-relaxed">
              Encurte os versos que menos importam e aprove de novo. Seu pedido
              continua pago e garantido — nada se perdeu.
            </p>
          </>
        )}
      </div>
    )}

    {state.rejection === "letra_protegida" && (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-5 mb-4">
        <p className="text-amber-200 font-semibold">⚠️ Precisamos ajustar a sua letra</p>
        <p className="text-white/70 text-sm mt-1.5 leading-relaxed">
          O estúdio de IA que produz a música identificou que a letra enviada tem
          trechos de uma música que já existe, e não pode gravá-la. Isso vale para
          letra de artista conhecido, mesmo que seja só um pedaço ou o refrão.
        </p>
        <p className="text-white/70 text-sm mt-3 leading-relaxed">
          Para seguir, edite a letra abaixo com palavras suas — ou peça para a
          gente compor uma original a partir da sua história, que é o que fazemos
          na maioria dos pedidos. Seu pedido continua pago e garantido.
        </p>
        <p className="text-white/40 text-xs mt-3 leading-relaxed">
          Escreveu você mesmo e acha que houve engano? Fale com a gente que
          resolvemos junto.
        </p>
      </div>
    )}

    <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.06] p-5 mb-4">
      <div className="mb-4">
        <p className="text-fuchsia-200 font-semibold flex items-center gap-2">🎼 Sua letra</p>
        {/* A explicação dos colchetes passou a ser necessária quando o
            compositor virou obrigado a marcar a estrutura: antes eles
            apareciam de vez em quando, agora aparecem SEMPRE, e sem uma
            linha explicando parecem defeito no meio de uma homenagem.
            Os players já removem essas linhas, então elas nunca são
            exibidas na música pronta nem cantadas. */}
        <p className="text-white/50 text-sm mt-0.5">
          Gere a letra, ajuste o que quiser e aprove antes da produção da música.
        </p>
        <p className="text-white/35 text-[13px] mt-1">
          As marcações entre colchetes — <span className="text-white/50">[Refrão]</span>, <span className="text-white/50">[Ponte]</span> — organizam a música e <strong className="text-white/50">não são cantadas</strong>. Pode deixá-las como estão.
        </p>
      </div>

      {!hasLyrics ? (
        <button
          onClick={gerar}
          disabled={busy !== null}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-all"
          style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 4px 20px rgba(240,25,107,0.35)" }}
        >
          {busy === "gerar" ? "Compondo sua letra…" : "✨ Gerar minha letra"}
        </button>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            // Sem `semRevisoes`: acabar a cota de IA travava justamente o
            // ajuste à mão — e é nesse estado que a própria tela diz "ajuste
            // à mão e aprove" (abaixo). A frase virou verdade.
            disabled={busy === "gerar" || busy === "reprocessar"}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm leading-relaxed outline-none focus:border-fuchsia-500/60 transition-colors whitespace-pre-wrap disabled:opacity-80"
            placeholder="A letra aparece aqui…"
          />

          {/* Contador. Só aparece perto do limite: mostrar "412/5.000" numa
              letra comum seria barulho, mas quem está escrevendo demais
              precisa saber ANTES de aprovar — era o que faltava quando uma
              letra de 5.400 foi aprovada e recusada depois na geração. */}
          {medida.total > LIMITE_LETRA * 0.8 && (
            <div className="mt-1 text-right">
              <p className={`text-[13px] ${medida.total > LIMITE_LETRA ? "text-amber-300 font-semibold" : "text-white/40"}`}>
                {nn(medida.total)} / {nn(LIMITE_LETRA)} caracteres
                {medida.total > LIMITE_LETRA && " — precisa encurtar"}
              </p>
              {/* A repartição, sempre que houver colchetes. É ela que evita o
                  corte no lugar errado: num caso real 3.460 dos 6.188
                  caracteres eram briefing de produção, e o total sozinho
                  mandava a pessoa apagar versos que caberiam. */}
              {medida.instrucoes > 0 && (
                <p className="text-[13px] text-white/40">
                  versos {nn(medida.cantada)} · instruções entre colchetes {nn(medida.instrucoes)}
                </p>
              )}
            </div>
          )}

          {busy === "gerar" && (
            <p className="text-fuchsia-300/70 text-sm mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse inline-block" />
              Compondo…
            </p>
          )}

          {/* Revisão com IA */}
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <input
              value={instrucao}
              onChange={(e) => setInstrucao(e.target.value)}
              disabled={busy !== null || semRevisoes}
              placeholder="O que você quer ajustar na letra?"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/60 transition-colors mb-2 disabled:opacity-50"
            />

            {/* Exemplos abaixo do campo, não dentro dele: num <input> de uma
                linha o texto é truncado, e aqui ele quebra e aparece inteiro.
                Medido nas larguras reais — o placeholder antigo ("O que você
                quer ajustar? (opcional)", 230px) era o único que não cabia num
                aparelho de 320px; o atual tem 213px e cabe em todos.

                São exemplos de TEXTO de propósito. O exemplo é a parte mais
                lida de um campo, e o pedido que essa caixa NÃO atende é
                justamente o de som ("mais animada"): ele vai pro compositor
                de letra e volta com as mesmas notas e outras palavras. Quem
                quer mexer no som tem o cartão "Como sua música vai soar", no
                passo seguinte.

                Escondido quando a cota acaba: ali o campo está desabilitado e
                a linha ao lado já diz pra ajustar à mão — manter exemplos de
                pedido à IA seria convidar pro que não dá mais pra fazer. */}
            {!semRevisoes && (
              <p className="text-[13px] text-white/45 mb-2">
                Ex.: trocar o 2º verso, incluir o nome da nossa filha, deixar o refrão mais curto.
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className={`text-sm ${semRevisoes ? "text-white/30" : "text-fuchsia-300/80"}`}>
                {semRevisoes ? "Sem revisões com IA — ajuste à mão e aprove" : `${state.reprocessLeft} de 3 revisões restantes`}
              </span>
              <button
                onClick={reprocessar}
                disabled={busy !== null || semRevisoes}
                className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white border border-fuchsia-500/40 bg-fuchsia-500/15 hover:bg-fuchsia-500/25 disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                {busy === "reprocessar" ? (
                  <><span className="w-3 h-3 border-2 border-fuchsia-300 border-t-transparent rounded-full animate-spin" /> Revisando…</>
                ) : "🔁 Pedir revisão à IA"}
              </button>
            </div>
          </div>

          {/* Confirmação da escolha, não aviso de erro: a pessoa editou à mão
              e vai seguir com a versão dela. Antes isto era amarelo e dizia
              "peça uma revisão à IA antes de continuar" — era o rótulo de um
              bloqueio que não existe mais. Sinalizar continua valendo: ela
              precisa saber que a IA NÃO vai passar por cima do que digitou, e
              que a conferência é dela. */}
          {editado && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
              <p className="text-sm font-semibold text-white/80">✍️ Letra editada por você</p>
              <p className="text-[13px] text-white/50 mt-0.5">
                A música será feita com a sua versão, sem revisão da IA. Confira o texto antes de continuar.
              </p>
            </div>
          )}

          {/* No modo fluxo, a aprovação fica no passo final (página). Aqui só geramos/revisamos. */}
          {!flowMode && (
            <>
            <TituloMusica
              orderId={orderId}
              lyrics={text}
              value={titulo}
              onChange={setTitulo}
              disabled={busy !== null}
            />
            <button
              onClick={aprovar}
              disabled={busy !== null || !podeAprovar}
              className="w-full mt-3 py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
              style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", boxShadow: "0 4px 20px rgba(34,197,94,0.3)" }}
            >
              {busy === "aprovar" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Aprovando…
                </span>
              ) : "✅ Aprovar letra"}
            </button>
            </>
          )}
        </>
      )}

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
    </div>
    </>
  )
}
