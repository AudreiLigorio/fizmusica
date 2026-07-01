"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

// Opt-in OPCIONAL de divulgação da obra (música + letra) pela Fiz Música.
// Livre e revogável. Desligado por padrão. Não divulga a identidade de quem encomendou.
export default function PublicacaoConsent({
  orderId,
  initial,
}: {
  orderId: string
  initial: boolean
}) {
  const [consent, setConsent] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState("")

  async function save(next: boolean) {
    setSaving(true)
    setSavedMsg("")
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/orders/${orderId}/publicacao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ consent: next }),
    })
    setSaving(false)
    if (res.ok) {
      setConsent(next)
      setSavedMsg(next ? "💜 Obrigado! Autorização registrada." : "Autorização removida.")
      setTimeout(() => setSavedMsg(""), 4000)
    } else {
      setSavedMsg("Não foi possível salvar. Tente de novo.")
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4">
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0">💜</span>
        <div className="min-w-0">
          <p className="text-fuchsia-200 font-semibold text-sm">Quer ajudar mais pessoas a se emocionarem? <span className="text-white/40 font-normal">(opcional)</span></p>
          <p className="text-white/55 text-xs leading-relaxed mt-1">
            Você pode autorizar a Fiz Música a divulgar <strong className="text-white/80">a sua música e a letra</strong> (que podem conter nomes e a história real como parte do conteúdo).
            <strong className="text-white/80"> Nunca divulgamos quem encomendou</strong> a música, nem usamos suas fotos. Você pode revogar quando quiser.{" "}
            <a href="/legal/autorizacao-de-publicacao" className="text-fuchsia-300 underline">Ler o termo</a>.
          </p>

          <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              disabled={saving}
              onChange={(e) => save(e.target.checked)}
              className="w-4 h-4 accent-fuchsia-500 shrink-0"
            />
            <span className="text-sm text-white/80">
              Autorizo a divulgação da minha música e letra
            </span>
          </label>

          {savedMsg && <p className="text-xs text-fuchsia-300/80 mt-2">{savedMsg}</p>}
        </div>
      </div>
    </div>
  )
}
