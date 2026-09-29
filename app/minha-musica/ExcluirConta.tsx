"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

// "Excluir minha conta", no fim da área. A Play Store exige que seja fácil de
// achar dentro do app; discreto aqui é de propósito — é uma saída, não um
// convite. O texto diz claramente o que some e o que fica ANTES de pedir a
// confirmação, porque "vou perder minhas músicas?" é o medo óbvio.
export default function ExcluirConta() {
  const [aberto, setAberto]       = useState(false)
  const [checando, setChecando]   = useState(false)
  const [bloqueio, setBloqueio]   = useState<string[]>([])
  const [texto, setTexto]         = useState("")
  const [enviando, setEnviando]   = useState(false)
  const [erro, setErro]           = useState("")

  async function token() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ""
  }

  async function abrir() {
    setAberto(true)
    setChecando(true)
    setErro("")
    const d = await fetch("/api/conta/excluir", { headers: { Authorization: `Bearer ${await token()}` } })
      .then((r) => r.json()).catch(() => ({}))
    setBloqueio(d.pedidosEmAndamento ?? [])
    setChecando(false)
  }

  async function excluir() {
    setEnviando(true)
    setErro("")
    const r = await fetch("/api/conta/excluir", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
      body: JSON.stringify({ confirmacao: texto }),
    })
    const d = await r.json().catch(() => ({}))
    if (r.status === 409) { setBloqueio(d.pedidos ?? []); setEnviando(false); return }
    if (!r.ok) { setErro(d.error ?? "Não foi possível excluir agora."); setEnviando(false); return }
    // O login já não existe no servidor; limpa a sessão local e mostra o fim.
    await supabase.auth.signOut().catch(() => {})
    window.location.replace("/excluir-conta?feito=1")
  }

  if (!aberto) {
    return (
      <div className="text-center mt-10">
        <button onClick={abrir} className="text-sm text-white/60 hover:text-red-300 underline underline-offset-4">
          Excluir minha conta
        </button>
      </div>
    )
  }

  return (
    <div className="mt-10 max-w-xl mx-auto bg-white/[0.04] border border-red-400/30 rounded-2xl p-5 sm:p-6 text-left">
      <h3 className="text-lg font-semibold text-white mb-3">Excluir minha conta</h3>

      {checando ? (
        <p className="text-sm text-white/70">Conferindo seus pedidos…</p>
      ) : bloqueio.length > 0 ? (
        <>
          <p className="text-sm text-white/85 leading-relaxed mb-2">
            Você tem uma música sendo feita agora. Para não deixá-la sem ninguém para receber, a conta só pode ser excluída depois que ela for entregue:
          </p>
          <ul className="text-sm text-white list-disc pl-5 mb-4">
            {bloqueio.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <p className="text-sm text-white/70 mb-4">
            Precisa de ajuda? Escreva para <a href="mailto:contato@fizmusica.com.br" className="underline">contato@fizmusica.com.br</a>.
          </p>
          <button onClick={() => setAberto(false)} className="text-sm text-white/80 underline underline-offset-4">Voltar</button>
        </>
      ) : (
        <>
          <p className="text-sm text-white/85 leading-relaxed mb-2"><strong className="text-white">O que será apagado:</strong> seu login, favoritos, playlists, apelido e foto, datas especiais, código de indicação e seus discos da Carreira.</p>
          <p className="text-sm text-white/85 leading-relaxed mb-4"><strong className="text-white">O que continua seu:</strong> as músicas que você comprou (arquivo e letra), como garante a Licença. Se criar uma conta de novo com o mesmo e-mail, elas voltam a aparecer. Suas palmas na Rede continuam contando para quem as recebeu, sem o seu nome.</p>

          <label className="block text-sm text-white font-medium mb-2" htmlFor="confirma-exclusao">
            Para confirmar, digite <strong>EXCLUIR</strong>
          </label>
          <input
            id="confirma-exclusao"
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setErro("") }}
            autoComplete="off"
            className="w-full bg-black/40 border border-white/25 rounded-xl px-4 py-3 text-white outline-none focus:border-red-400 mb-3"
          />
          {erro && <p className="text-sm text-red-300 mb-3">{erro}</p>}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button onClick={() => setAberto(false)} className="flex-1 py-3 rounded-xl border border-white/20 text-white/90 text-sm font-medium">
              Cancelar
            </button>
            <button
              onClick={excluir}
              disabled={enviando || texto.trim().toUpperCase() !== "EXCLUIR"}
              className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-semibold"
            >
              {enviando ? "Excluindo…" : "Excluir minha conta"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
