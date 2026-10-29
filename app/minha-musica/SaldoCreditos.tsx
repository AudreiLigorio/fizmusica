"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { fmtDateBR } from "@/lib/date"

type Lancamento = {
  delta: number
  origem: "pacote" | "consumo" | "estorno" | "ajuste_admin"
  descricao: string | null
  em: string
}

// Saldo do pacote pré-pago.
//
// Fica ACIMA da Carreira e visualmente separado dela de propósito: são DUAS
// moedas no mesmo produto, e misturá-las numa caixa só é como a pessoa passa
// a achar que disco vira música. Disco é fidelidade — ganho, vira desconto
// em porcentagem. Crédito é pré-pago — comprado, vira música inteira. Cada um
// na sua caixa, com a sua palavra.
//
// E só aparece quando há saldo ou histórico: um painel zerado no caminho de
// quem nunca comprou pacote é ruído, e ainda anuncia um produto no lugar
// errado (a venda é na vitrine, não aqui).
const ROTULO: Record<Lancamento["origem"], string> = {
  pacote: "Pacote comprado",
  consumo: "Música criada",
  estorno: "Devolução",
  ajuste_admin: "Ajuste",
}

export default function SaldoCreditos() {
  const router = useRouter()
  const [saldo, setSaldo] = useState<number | null>(null)
  const [extrato, setExtrato] = useState<Lancamento[]>([])
  const [verExtrato, setVerExtrato] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { if (vivo) setSaldo(0); return }
      const r = await fetch("/api/creditos", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then((x) => x.json()).catch(() => null)
      if (!vivo) return
      setSaldo(Number(r?.saldo ?? 0))
      setExtrato(Array.isArray(r?.extrato) ? r.extrato : [])
    })()
    return () => { vivo = false }
  }, [])

  // `null` = ainda carregando: não pisca um painel que pode nem existir.
  if (saldo === null) return null
  if (saldo === 0 && extrato.length === 0) return null

  return (
    <div className="mb-6">
      <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.07] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-white/55">Seu pacote</p>
            <p className="text-3xl font-extrabold text-fuchsia-200 leading-tight mt-0.5">
              {saldo}{" "}
              <span className="text-base font-medium text-white/50">
                {saldo === 1 ? "música" : "músicas"} para criar
              </span>
            </p>
          </div>
          <button
            onClick={() => router.push("/criar")}
            disabled={saldo === 0}
            className="shrink-0 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-40 transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg,#f0196b,#d946ef)" }}
          >
            Criar agora
          </button>
        </div>

        {saldo === 0 && (
          <p className="text-[13px] text-white/45 mt-3">
            Seu pacote acabou. Você pode comprar outro na página inicial.
          </p>
        )}

        {extrato.length > 0 && (
          <>
            <button
              onClick={() => setVerExtrato((v) => !v)}
              className="mt-4 text-[13px] text-white/45 hover:text-white/70 transition-colors"
            >
              {verExtrato ? "Ocultar histórico ▲" : "Ver histórico do saldo ▾"}
            </button>
            {verExtrato && (
              <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
                {extrato.map((l, i) => (
                  <li key={i} className="flex items-center gap-3 text-[13px]">
                    {/* Fonte monoespaçada e largura fixa no número: sem isso
                        os sinais não alinham e a coluna fica serrilhada. */}
                    <span className={`font-bold font-mono w-8 shrink-0 text-right ${l.delta > 0 ? "text-green-400" : "text-red-400"}`}>
                      {l.delta > 0 ? "+" : ""}{l.delta}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-white/70">
                      {l.descricao || ROTULO[l.origem]}
                    </span>
                    <span className="text-white/30 shrink-0">{fmtDateBR(l.em)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
