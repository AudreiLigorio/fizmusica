"use client"

import { useEffect, useState } from "react"
import { blocosDoEstilo, inserirBloco, removerBloco, temBloco } from "@/lib/blocosEstrutura"

// Card "Como sua música vai soar" — última conferência antes de gerar.
//
// Até agora esse texto era invisível: o estilo era extraído no disparo da
// geração, usado e esquecido. O cliente aprovava a letra sem saber COMO a
// música ia soar, e só descobria depois de pronta.
//
// Mostrar aqui resolve três coisas de uma vez:
//  1. ele confere o que a IA entendeu do pedido dele;
//  2. corrige se estiver errado, ANTES de gastar a geração;
//  3. a expectativa passa a ser sobre o SOM descrito — não sobre um artista
//     que o motor não imita. Esse terceiro é o ponto comercial: prometer
//     menos e cumprir é o que evita "não gostei".
//
// Vive na tela de aprovar, e não num passo próprio: passo novo antes de uma
// ação irreversível é atrito, e aqui ele está ao lado do botão que importa.
export default function EstiloSonoro({
  orderId,
  disabled,
  estiloMusical,
  letra,
  onLetra,
}: {
  orderId: string
  disabled?: boolean
  // Define QUAIS blocos aparecem: só os medidos para este gênero.
  estiloMusical?: string | null
  // A letra é a FONTE DA VERDADE dos blocos: a caixa marcada é só o reflexo
  // de a marcação estar no texto. Assim quem digita `[Solo de Guitarra]` na
  // mão vê a caixa marcar sozinha, e não existem dois estados pra divergir.
  letra?: string
  onLetra?: (nova: string) => void
}) {
  const [estilo, setEstilo] = useState("")
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch(`/api/orders/${orderId}/estilo`)
      .then((r) => r.json())
      .then((d) => { if (vivo && d.estilo) { setEstilo(d.estilo); setSalvo(!!d.confirmado) } })
      .catch(() => { /* silêncio: sem o card, o disparo extrai como antes */ })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [orderId])

  async function salvar(texto: string) {
    setEstilo(texto)
    setEditando(false)
    // Falha aqui não pode travar a aprovação: sem o estilo salvo, o disparo
    // extrai automaticamente, que é o comportamento de antes deste card.
    await fetch(`/api/orders/${orderId}/estilo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estilo: texto }),
    }).then(() => setSalvo(true)).catch(() => {})
  }

  if (carregando) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 mb-3">
        <p className="text-white/40 text-xs">🎛 Preparando a sonoridade…</p>
      </div>
    )
  }
  if (!estilo) return null

  const blocos = blocosDoEstilo(estiloMusical)
  const podeBlocos = blocos.length > 0 && !!letra && !!onLetra && !disabled

  return (
    <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-3 mb-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-fuchsia-200 font-semibold text-xs">🎛 Como sua música vai soar</p>
        {!editando && !disabled && (
          <button
            onClick={() => setEditando(true)}
            className="text-[11px] text-fuchsia-300/80 hover:text-fuchsia-200 underline shrink-0"
          >
            editar
          </button>
        )}
      </div>

      {editando ? (
        <>
          <textarea
            value={estilo}
            onChange={(e) => setEstilo(e.target.value)}
            rows={2}
            maxLength={200}
            className="w-full rounded-lg bg-black/30 border border-white/15 p-2 text-xs text-white/85 outline-none focus:border-fuchsia-400/50"
          />
          {/* O aviso é curto de propósito, mas precisa existir: nome de
              artista no campo faz o Suno RECUSAR a geração inteira. */}
          <p className="text-[10px] text-white/35 mt-1">
            Descreva o som (instrumentos, ritmo, clima). Evite nomes de bandas ou cantores — o motor não aceita.
          </p>
          <button
            onClick={() => salvar(estilo)}
            className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)" }}
          >
            Salvar
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-white/70 leading-relaxed">
            {estilo.split(",").map((t) => t.trim()).filter(Boolean).join(" · ")}
          </p>
          <p className="text-[10px] text-white/35 mt-1.5">
            Foi assim que entendemos o seu pedido. {salvo ? "Confirmado por você." : "Pode ajustar antes de gerar."}
          </p>

          {/* Blocos: só os que foram MEDIDOS neste gênero (ver
              lib/blocosEstrutura.ts). Gênero sem bloco aprovado não mostra
              nada — melhor do que oferecer algo que não acontece. */}
          {podeBlocos && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-[10px] uppercase tracking-wide font-bold text-white/30 mb-2">Incluir na música</p>
              <div className="flex flex-wrap gap-1.5">
                {blocos.map((b) => {
                  const ativo = temBloco(letra!, b.tag)
                  return (
                    <button
                      key={b.tag}
                      type="button"
                      title={b.ajuda}
                      onClick={() => onLetra!(ativo ? removerBloco(letra!, b.tag) : inserirBloco(letra!, b.tag))}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                        ativo
                          ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-100"
                          : "border-white/12 text-white/50 hover:text-white/80 hover:border-white/25"
                      }`}
                    >
                      {ativo ? "✓ " : "+ "}{b.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-white/30 mt-1.5">
                Aparece como marcação na letra, e não é cantado.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
