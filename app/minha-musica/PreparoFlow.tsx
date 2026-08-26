"use client"

import { useEffect, useRef, useState } from "react"
import LetraPanel from "./LetraPanel"
import FotosPanel from "./FotosPanel"
import TituloMusica from "./TituloMusica"

// Fluxo guiado de preparo da música: Letra → Fotos → Aprovar & gerar.
// Compartilhado entre a área logada (/minha-musica) e a página tokenizada
// sem login (/preparar/[token]). A aprovação trava letra+fotos e dispara a geração.
export default function PreparoFlow({
  orderId,
  photoToken,
  isRevision,
  temFotos = true,
  onApproved,
}: {
  orderId: string
  photoToken?: string | null
  isRevision?: boolean
  // Plano sem fotos pula o passo inteiro: Letra → Aprovar.
  temFotos?: boolean
  onApproved?: () => void
}) {
  const [letra, setLetra] = useState<{ lyrics: string; canApprove: boolean }>({ lyrics: "", canApprove: false })
  const [showFotos, setShowFotos] = useState(false)
  const [photosConfirmed, setPhotosConfirmed] = useState(false)
  const [approving, setApproving] = useState(false)
  const [titulo, setTitulo] = useState("")

  async function approveAndGenerate() {
    setApproving(true)
    const res = await fetch(`/api/orders/${orderId}/letra/aprovar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lyrics: letra.lyrics, musicName: titulo }),
    })
    setApproving(false)
    if (res.ok) onApproved?.()
  }

  const activeStep = temFotos
    ? (photosConfirmed ? 3 : showFotos ? 2 : 1)
    : (photosConfirmed ? 2 : 1)

  // Ao avançar de passo, traz o mini-stepper (e o novo conteúdo) pro topo da
  // tela — sem isso, o passo novo pode renderizar fora da área visível.
  const rootRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [activeStep])

  return (
    <div ref={rootRef} className="space-y-3">
      {isRevision && !photosConfirmed && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3 border border-fuchsia-500/30 bg-fuchsia-500/[0.08]">
          <span className="text-fuchsia-300 text-lg shrink-0">🔁</span>
          <div className="min-w-0">
            <p className="text-fuchsia-200 font-semibold text-sm">Revisão — ajuste o que quiser</p>
            <p className="text-fuchsia-300/70 text-xs leading-relaxed">
              Você pode trocar a <strong>letra</strong>{temFotos ? <> ou as <strong>fotos</strong></> : null} e gerar uma nova versão.
              Se já estiver tudo certo, gere direto.
            </p>
            <button
              onClick={() => { if (temFotos) setShowFotos(true); setPhotosConfirmed(true) }}
              className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200 hover:bg-fuchsia-500/25 transition-colors"
            >
              Está tudo certo — gerar nova versão →
            </button>
          </div>
        </div>
      )}

      {/* Mini-stepper do preparo — plano sem fotos vai direto de Letra a Aprovar */}
      <div className="flex items-center gap-2 text-[11px] px-0.5">
        {(temFotos
          ? [{ n: 1, label: "Letra" }, { n: 2, label: "Fotos" }, { n: 3, label: "Aprovar" }]
          : [{ n: 1, label: "Letra" }, { n: 2, label: "Aprovar" }]
        ).map((s, idx, arr) => {
          const on = s.n <= activeStep
          return (
            <div key={s.n} className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${on ? "bg-fuchsia-500 text-white" : "bg-white/10 text-white/40"}`}>{s.n}</span>
              <span className={on ? "text-fuchsia-200" : "text-white/40"}>{s.label}</span>
              {idx < arr.length - 1 && <span className="w-4 h-px bg-white/15" />}
            </div>
          )
        })}
      </div>

      {/* PASSO 1 — letra (gerar/editar/revisar) */}
      <LetraPanel orderId={orderId} flowMode onState={setLetra} />

      {/* Avança para fotos (ou direto pra aprovação, em plano sem fotos) */}
      {!showFotos && !photosConfirmed && (
        <button
          onClick={() => (temFotos ? setShowFotos(true) : setPhotosConfirmed(true))}
          disabled={!letra.canApprove}
          className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
          style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
        >
          {temFotos ? "Continuar para fotos →" : "Continuar →"}
        </button>
      )}

      {/* PASSO 2 — fotos (editáveis até aprovar) */}
      {temFotos && showFotos && (
        <>
          {photoToken ? (
            <FotosPanel token={photoToken} />
          ) : (
            <p className="text-white/40 text-xs px-1">Não há álbum de fotos para este pedido — você pode seguir sem fotos.</p>
          )}
          {!photosConfirmed && (
            <div className="flex gap-2">
              <button
                onClick={() => setPhotosConfirmed(true)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
              >
                ✓ Confirmar fotos →
              </button>
              <button
                onClick={() => setPhotosConfirmed(true)}
                className="px-4 py-3 rounded-xl text-sm font-medium text-white/60 border border-white/15 hover:bg-white/5 transition-colors"
              >
                Pular
              </button>
            </div>
          )}
        </>
      )}

      {/* PASSO 3 — aprovar & gerar (irreversível) */}
      {photosConfirmed && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/[0.08] p-4">
          <p className="text-yellow-300 font-semibold text-sm mb-1">⚠️ Tudo pronto para gerar</p>
          <p className="text-yellow-400/70 text-xs leading-relaxed mb-3">
            Ao aprovar, a música é <strong>gerada automaticamente</strong> e a <strong>letra fica travada</strong>.
            As fotos você ainda pode ajustar depois, inclusive com a música pronta.
          </p>

          <div className="mb-3">
            <TituloMusica
              orderId={orderId}
              lyrics={letra.lyrics}
              value={titulo}
              onChange={setTitulo}
              disabled={approving}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {temFotos && (
              <button
                onClick={() => setPhotosConfirmed(false)}
                className="px-3 py-2.5 rounded-xl text-xs font-medium text-white/60 border border-white/15 hover:bg-white/5 transition-colors"
              >
                ← Ajustar fotos
              </button>
            )}
            <button
              onClick={approveAndGenerate}
              disabled={approving || !letra.canApprove}
              className="flex-1 min-w-[180px] py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
              style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}
            >
              {approving ? "Gerando…" : "✅ Aprovar e gerar minha música"}
            </button>
          </div>
          {!letra.canApprove && (
            <p className="text-yellow-400/70 text-[11px] mt-2">Revise a letra acima (peça uma revisão à IA) antes de gerar.</p>
          )}
        </div>
      )}
    </div>
  )
}
