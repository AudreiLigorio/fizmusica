"use client"

import { useEffect, useState } from "react"

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
}: {
  orderId: string
  disabled?: boolean
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
        </>
      )}
    </div>
  )
}
