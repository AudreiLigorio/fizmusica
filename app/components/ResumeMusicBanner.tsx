"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const SESSION_KEY = "fizmusica_session_id"

// Aviso discreto na home: se houver uma música em andamento salva neste navegador
// (localStorage), oferece continuar de onde parou. Cobre o caso "fechei e reabri o
// navegador e caí na home" — a retomada de dentro do /criar só aparece lá dentro.
// Limite: só funciona no mesmo navegador; cross-device é coberto pelo e-mail de recuperação.
export default function ResumeMusicBanner() {
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
