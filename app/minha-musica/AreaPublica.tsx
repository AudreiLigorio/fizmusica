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
import CarreiraPublica from "./CarreiraPublica"

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

// Bloco de convite — mesma peça nas três abas pessoais, muda só o texto.
//
// Título e corpo seguem a escala da aba Músicas (RedeFizMusica.tsx): h2
// text-xl font-bold, descrição text-xs — pra não ter uma aba com título
// maior que a outra dentro da mesma área.
function Convite({ icone, titulo, frase, acao, onAcao }: {
  icone: string; titulo: string; frase: string; acao: string; onAcao: () => void
}) {
  return (
    <div className="text-center py-14 px-6">
      <div className="text-5xl mb-4">{icone}</div>
      <h2 className="text-xl font-bold mb-2">{titulo}</h2>
      <p className="text-white/50 text-xs leading-relaxed max-w-xs mx-auto mb-6">{frase}</p>
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

  const entrar = () => router.push("/entrar")

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
        {/* Com botão: o "Entrar" do visitante fica no topo, igual à home.
            O Header já se esconde sozinho pra quem está logado. */}
        <Header />

        <section className="max-w-3xl lg:max-w-5xl mx-auto px-5 pt-24 pb-40 sm:pb-16">
          {/* Sem título nem botão próprios: cada aba já traz o seu título (a
              Rede tem o dela, os vazios têm o do convite) e o "Entrar" agora
              vive no topo, no Header, como na home. */}
          <TabsDesktop aba={aba} onAba={irPara} onCriar={() => router.push("/criar")} />

          {/* ── MÚSICAS: o coração da visita. Toca sem pedir nada. ───────── */}
          {aba === "musicas" && (
            <>
              <BuscaMusicas valor={busca} onValor={setBusca} resultados={busca.trim() ? nRede : null} />
              <RedeFizMusica busca={busca} onContagem={setNRede} onPrecisaLogin={entrar} />

              {/* A playlist vazia vem DEPOIS da Rede de propósito: só faz
                  sentido como convite pra quem já ouviu algo e quis guardar. */}
              <div className="mt-12 pt-10 border-t border-white/[0.06]">
                {/* text-xl, igual ao "Rede Fiz Música" logo acima — antes
                    estava text-2xl, maior que o título da própria aba. */}
                <h2 className="text-xl font-bold mb-1">Minha playlist</h2>
                {/* Sem link de "Entrar" aqui: o botão do topo é o único ponto
                    de entrada, pra não repetir a mesma ação em dois lugares. */}
                <p className="text-white/50 text-xs">
                  Crie uma conta pra guardar as que você gostou.
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

          {aba === "carreira" && <CarreiraPublica onEntrar={entrar} />}

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
