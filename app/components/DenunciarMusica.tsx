"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "@/lib/supabase"
import { idDeSessao } from "@/lib/track"
import { MOTIVOS_DENUNCIA, type MotivoDenuncia } from "@/lib/denuncia"

// Modal "Denunciar esta música" — usado no player cheio e na página pública
// /rede/[id]. Exigência da Play Store para conteúdo gerado por usuário (ver
// app/api/rede/denunciar). Funciona sem conta.
//
// Segue o tema escolhido (claro/escuro) pelas classes `fm-popup` /
// `fm-popup-fundo` de app/globals.css — mesmo quando aberto sobre o player.
// (Antes era `data-zona-escura`, sempre escuro; o Audrei pediu, em
// 2026-10-10, que os popups acompanhem o tema.) Nota antiga, mantida:
// o modal vai por portal para o <body>, fora do player, e
// abre por cima de telas escuras (player, /rede). Sem a marca, o tema claro
// trocaria só o texto e deixaria o cartão escuro com letra escura.
export default function DenunciarMusica({ orderId, open, onClose }: {
  orderId: string
  open: boolean
  onClose: () => void
}) {
  const [motivo, setMotivo] = useState<MotivoDenuncia | null>(null)
  const [detalhe, setDetalhe] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const abertoEm = useRef(0)

  // Cada abertura começa do zero — inclusive ao trocar de música no player.
  useEffect(() => {
    if (open) { setMotivo(null); setDetalhe(""); setErro(null); setEnviado(false); abertoEm.current = Date.now() }
  }, [open, orderId])

  // No player o botão abre o modal no DESCER do dedo (ver `aoAcionar` no
  // MiniPlayer — conserto do toque travado no iOS). O clique que o navegador
  // gera ao SOLTAR o dedo cai então no fundo escuro, que fecha o modal: ele
  // abria e sumia no mesmo toque. Clique no fundo logo após abrir é ignorado.
  function fecharPeloFundo() {
    if (Date.now() - abertoEm.current < 600) return
    onClose()
  }

  if (!open || typeof document === "undefined") return null

  async function enviar() {
    if (!motivo) { setErro("Escolha um motivo."); return }
    setEnviando(true); setErro(null)
    try {
      // Token opcional: se a pessoa estiver logada, a denúncia guarda quem
      // foi (ajuda o admin a separar denúncia séria de abuso). Sem login, vai
      // anônima do mesmo jeito.
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      const res = await fetch("/api/rede/denunciar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ orderId, motivo, detalhe, sessao: idDeSessao() }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(j.error ?? "Não foi possível enviar agora. Tente de novo."); return }
      setEnviado(true)
    } catch {
      setErro("Sem conexão. Tente de novo.")
    } finally {
      setEnviando(false)
    }
  }

  return createPortal(
    <div
         className="fm-popup-fundo fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 text-white"
         onClick={fecharPeloFundo}>
      <div role="dialog" aria-modal="true" aria-labelledby="denunciar-titulo"
           onClick={(e) => e.stopPropagation()}
           className="fm-popup w-full max-w-sm rounded-2xl border border-white/10 bg-[#15111f] p-5 max-h-[90dvh] overflow-y-auto">
        {enviado ? (
          <div className="text-center py-2">
            <div className="text-3xl mb-2">🙏</div>
            <p id="denunciar-titulo" className="font-semibold">Obrigado por avisar</p>
            <p className="text-sm text-white/60 mt-1.5 leading-relaxed">
              Nossa equipe vai analisar esta música. Se ela não seguir as regras da Rede, sai do ar.
            </p>
            <button onClick={onClose}
                    className="mt-5 w-full py-2.5 rounded-xl text-sm font-bold text-white border border-white/15 hover:border-white/35">
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <p id="denunciar-titulo" className="font-semibold text-sm">🚩 Denunciar esta música</p>
              <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none" aria-label="Fechar">✕</button>
            </div>
            <p className="text-sm text-white/50 mb-4">O que há de errado? Sua denúncia é anônima para o autor.</p>

            <div role="radiogroup" className="space-y-2">
              {MOTIVOS_DENUNCIA.map((m) => (
                <button key={m.id} role="radio" aria-checked={motivo === m.id}
                        onClick={() => { setMotivo(m.id); setErro(null) }}
                        className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                          motivo === m.id
                            ? "border-pink-500/70 bg-pink-500/10 text-white"
                            : "border-white/10 bg-white/[0.03] text-white/80 hover:border-white/30"
                        }`}>
                  {m.rotulo}
                </button>
              ))}
            </div>

            {motivo && (
              <textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} maxLength={1000} rows={3}
                        placeholder={motivo === "outro" ? "Conte o que há de errado (obrigatório)" : "Quer contar mais? (opcional)"}
                        className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-pink-500/60" />
            )}

            {erro && <p className="text-sm text-red-400 mt-3">{erro}</p>}

            <button onClick={enviar} disabled={enviando || !motivo}
                    className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
              {enviando ? "Enviando…" : "Enviar denúncia"}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
