"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const SESSION_KEY = "fizmusica_session_id"

// Aviso discreto na home: se houver uma música em andamento salva neste navegador
// (localStorage), oferece continuar de onde parou. Cobre o caso "fechei e reabri o
// navegador e caí na home" — a retomada de dentro do /criar só aparece lá dentro.
// Limite: só funciona no mesmo navegador; cross-device é coberto pelo e-mail de recuperação.
// `formato="cartao"`: versão no fluxo da página (não flutuante), usada no
// topo do SpotFiz no app — quem saiu do wizard explora o app sem esquecer
// que tem uma música começada.
export default function ResumeMusicBanner({ formato = "flutuante" }: { formato?: "flutuante" | "cartao" }) {
  const router = useRouter()
  const [info, setInfo] = useState<{ orderId?: string; sub: string } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem(SESSION_KEY)
    if (!id) return
    fetch(`/api/wizard-session?id=${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const s = json?.session
        if (!s || !s.data) return
        // Só oferece se o cliente já avançou de verdade (passou do 1º passo) ou já criou o pedido.
        if ((s.step ?? 0) <= 1 && !s.data.orderId) return
        setInfo({ orderId: s.data.orderId, sub: s.data.selectedSubcategory || "" })
      })
      .catch(() => {})
  }, [])

  if (!info || dismissed) return null

  // Se o pedido já foi criado, o próximo passo é o pagamento; senão, retoma o wizard.
  const href = info.orderId ? `/produtos?orderId=${info.orderId}` : "/criar"

  if (formato === "cartao") {
    return (
      <div className="fm-cartao-retomar mb-5 flex items-center gap-3 rounded-2xl px-4 py-3 border border-pink-500/40"
           style={{ background: "linear-gradient(135deg, rgba(240,25,107,0.14), rgba(217,70,239,0.10))" }}>
        <span className="text-2xl shrink-0" aria-hidden="true">🎵</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Sua música{info.sub ? ` de ${info.sub}` : ""} está salva</p>
          <button onClick={() => router.push(href)} className="text-[13px] font-semibold text-pink-300 hover:underline">
            Continuar de onde parei →
          </button>
        </div>
        <button onClick={() => setDismissed(true)} aria-label="Fechar" className="shrink-0 text-white/50 hover:text-white text-lg leading-none">×</button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 max-w-[92vw] rounded-2xl px-4 py-3 text-sm text-white shadow-2xl"
         style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)", boxShadow: "0 10px 40px rgba(240,25,107,0.45)" }}>
      <button onClick={() => router.push(href)} className="flex items-center gap-2 font-medium text-left hover:underline">
        🎵 Continue sua música{info.sub ? ` de ${info.sub}` : ""} de onde parou →
      </button>
      <button onClick={() => setDismissed(true)} aria-label="Fechar" className="shrink-0 text-white/80 hover:text-white text-lg leading-none">
        ×
      </button>
    </div>
  )
}
