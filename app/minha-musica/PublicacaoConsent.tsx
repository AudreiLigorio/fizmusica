"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { apelidoPadrao } from "@/lib/apelido"

// Opt-in OPCIONAL de divulgação da obra (música + letra) pela Fiz Música.
// Livre e revogável. Desde 2026-09-14 a obra sai ASSINADA com o apelido do
// autor (primeiro nome da conta), mostrado antes do aceite e desligável em
// Carreira. Antes disso o padrão era o anonimato — ver legal/07.
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
  // A assinatura aparece ANTES do aceite, não depois: consentimento informado
  // é saber o que vai acontecer no momento de decidir. Descobrir o próprio
  // nome publicado depois do clique é o oposto disso.
  const [assinatura, setAssinatura] = useState<string | null>(null)
  const [recusouAssinar, setRecusouAssinar] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const u = session?.user
      if (!u) return
      const r = await fetch("/api/perfil", {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      }).then((x) => x.json()).catch(() => null)

      // Apelido já escolhido manda sobre o padrão — inclusive quando a pessoa
      // desligou a exibição. É a mesma regra que o servidor aplica ao salvar.
      if (r?.apelido) {
        setAssinatura(r.mostrarApelido ? r.apelido : null)
        setRecusouAssinar(!r.mostrarApelido)
        return
      }
      setAssinatura(apelidoPadrao(u.user_metadata?.full_name as string | undefined, u.email))
    })()
  }, [])

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
          {/* Mesmo texto do portão da entrega (page.tsx) — os dois pedem a
              MESMA autorização, e dizer diferente em cada lugar é o tipo de
              divergência que aparece numa contestação.
              Duas correções de conteúdo:
              - "nem usamos suas fotos" virou "as fotos não aparecem na Rede":
                a primeira era falsa, porque o link /m/{slug} que o próprio
                cliente compartilha MOSTRA as fotos — e isso é escolha dele.
              - o limite da revogação passou a ser explícito: ela impede
                novas exibições, não recupera o que alguém já salvou. */}
          <p className="text-white/55 text-xs leading-relaxed mt-1">
            Você pode autorizar a Fiz Música a divulgar <strong className="text-white/80">a sua música e a letra</strong> na Rede Fiz Música (que podem conter nomes e a história real como parte do conteúdo).
            <strong className="text-white/80"> As suas fotos não aparecem na Rede</strong> — só a capa gerada automaticamente.
            {/* O endereço público entra AQUI, e não só no termo: é o ponto em
                que a consequência da autorização sai da plataforma. A partir
                dele a música circula por qualquer canal, sem conta. */}
            {" "}Ela ganha um <strong className="text-white/80">endereço público</strong> que qualquer pessoa pode abrir e compartilhar.
            Você pode revogar quando quiser.{" "}
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

          {(assinatura || recusouAssinar) && (
            <p className="text-[11px] text-white/45 mt-2 leading-relaxed">
              {recusouAssinar ? (
                <>Suas músicas aparecem <strong className="text-white/60">sem identificação do autor</strong> — foi o que você escolheu em Carreira.</>
              ) : (
                <>Vai aparecer assinada como <strong className="text-white/70">{assinatura}</strong>.{" "}
                  <a href="/minha-musica?aba=carreira" className="text-fuchsia-300/80 underline">mudar ou esconder</a>
                </>
              )}
            </p>
          )}

          {savedMsg && <p className="text-xs text-fuchsia-300/80 mt-2">{savedMsg}</p>}
        </div>
      </div>
    </div>
  )
}
