"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Header from "@/app/components/Header"
import RedeFizMusica from "./RedeFizMusica"
import MiniPlayer from "./MiniPlayer"
import BuscaMusicas from "./BuscaMusicas"
import { PlayerProvider } from "./PlayerContext"
import { ToastProvider } from "./ToastContext"
import { TabBarMobile, TabsDesktop, FecharPlayerForaDeMusicas, type Aba } from "./AreaTabs"

// A área do cliente vista por quem ainda não tem conta.
//
// Vive num componente separado, e não em ramos `user && ...` espalhados pela
// page.tsx (1000 linhas), por dois motivos: a tela logada continua com risco
// zero de regressão, e esta aqui reverte sozinha se não funcionar.
//
// A regra que rege tudo abaixo: a Rede toca de verdade, sem pedir nada. O que
// é pessoal (playlist, pedidos, discos) aparece VAZIO e explicado — o vazio é
// o convite. Cada aba tem no máximo uma frase e um botão; qualquer coisa além
// disso vira parede de texto pra quem só queria ouvir uma música.

type Nivel = { id: number; icone: string; nome: string; minDiscos: number; descontoDigital: number }

// Bloco de convite — mesma peça nas três abas pessoais, muda só o texto.
function Convite({ icone, titulo, frase, acao, onAcao }: {
  icone: string; titulo: string; frase: string; acao: string; onAcao: () => void
}) {
  return (
    <div className="text-center py-14 px-6">
      <div className="text-5xl mb-4">{icone}</div>
      <h2 className="text-2xl font-bold mb-2">{titulo}</h2>
      <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto mb-6">{frase}</p>
      <button
        onClick={onAcao}
        className="px-7 py-3 rounded-full font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95"
        style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
      >
        {acao}
      </button>
    </div>
  )
}

export default function AreaPublica({ abaInicial }: { abaInicial: Aba }) {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>(abaInicial === "home" ? "musicas" : abaInicial)
  const [busca, setBusca] = useState("")
  const [nRede, setNRede] = useState(0)
  const [trilha, setTrilha] = useState<Nivel[] | null>(null)

  const entrar = () => router.push("/entrar")

  // Só a trilha de níveis — a API devolve `publico: true` e nenhum dado de
  // cliente quando não há sessão.
  useEffect(() => {
    if (aba !== "carreira") return
    fetch("/api/carreira")
      .then((r) => r.json())
      .then((d) => setTrilha(d.trilha ?? []))
      .catch(() => setTrilha([]))
  }, [aba])

  function irPara(a: Aba) {
    if (a === "home") { router.push("/"); return }
    setAba(a)
  }

  return (
    <PlayerProvider>
    <ToastProvider>
    <div className="relative min-h-screen text-white font-sans overflow-hidden" style={{ background: "#07060d" }}>
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0" style={{ background: "radial-gradient(55% 45% at 12% 6%, rgba(240,25,107,0.26) 0%, transparent 60%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(55% 50% at 90% 96%, rgba(168,85,247,0.24) 0%, transparent 62%)" }} />
      </div>

      <div className="relative z-10">
        <Header showButton={false} />

        <section className="max-w-3xl lg:max-w-5xl mx-auto px-5 pt-24 pb-40 sm:pb-16">
          {/* Sem título próprio: cada aba já traz o seu (a Rede tem o dela, os
              vazios têm o do convite). Um h1 aqui em cima repetia o de baixo. */}
          <div className="flex justify-end mb-5">
            <button onClick={entrar} className="text-sm text-white/70 hover:text-white transition-colors border border-white/15 rounded-full px-4 py-2">
              Entrar
            </button>
          </div>

          <TabsDesktop aba={aba} onAba={irPara} onCriar={() => router.push("/criar")} />

          {/* ── MÚSICAS: o coração da visita. Toca sem pedir nada. ───────── */}
          {aba === "musicas" && (
            <>
              <BuscaMusicas valor={busca} onValor={setBusca} resultados={busca.trim() ? nRede : null} />
              <RedeFizMusica busca={busca} onContagem={setNRede} onPrecisaLogin={entrar} />

              {/* A playlist vazia vem DEPOIS da Rede de propósito: só faz
                  sentido como convite pra quem já ouviu algo e quis guardar. */}
              <div className="mt-12 pt-10 border-t border-white/[0.06]">
                <h2 className="text-2xl font-bold mb-1">Minha playlist</h2>
                <p className="text-gray-400 text-sm">
                  Crie uma conta pra guardar as que você gostou.{" "}
                  <button onClick={entrar} className="text-pink-400 hover:text-pink-300 underline">Entrar</button>
                </p>
              </div>
            </>
          )}

          {aba === "pedidos" && (
            <Convite
              icone="🎁"
              titulo="Suas músicas ficam aqui"
              frase="Depois que você encomenda uma música, é nesta tela que ela aparece — com a letra, as fotos e o link pra presentear."
              acao="Criar minha música"
              onAcao={() => router.push("/criar")}
            />
          )}

          {aba === "carreira" && (
            <div className="py-8">
              <div className="text-center mb-10">
                <div className="text-5xl mb-4">💿</div>
                <h2 className="text-2xl font-bold mb-2">Minha Carreira</h2>
                <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
                  Cada música que você cria rende discos. Os discos sobem seu nível — e cada nível dá desconto na próxima.
                </p>
              </div>

              {trilha === null ? (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-2.5 max-w-md mx-auto">
                  {trilha.map((n) => (
                    <div key={n.id} className="flex items-center gap-4 bg-white/[0.04] rounded-2xl px-5 py-4">
                      <div className="text-2xl shrink-0">{n.icone}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{n.nome}</p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {n.minDiscos === 0 ? "de início" : `a partir de ${n.minDiscos} 💿`}
                        </p>
                      </div>
                      {n.descontoDigital > 0 && (
                        <div className="shrink-0 text-sm font-bold text-pink-300">{n.descontoDigital}% off</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center mt-8">
                <button
                  onClick={entrar}
                  className="px-7 py-3 rounded-full font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95"
                  style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
                >
                  Começar minha carreira
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>

    <MiniPlayer />
    <FecharPlayerForaDeMusicas aba={aba} />
    <TabBarMobile aba={aba} onAba={irPara} onCriar={() => router.push("/criar")} />
    </ToastProvider>
    </PlayerProvider>
  )
}
