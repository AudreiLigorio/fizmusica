// Grava um tutorial: navega pelo sistema de verdade, com vídeo contínuo, e
// casa a navegação com uma narração sintética.
//
// A ORDEM importa e é o coração disto: a narração é gerada ANTES de o
// navegador abrir. Cada cena então dura exatamente o tempo da sua frase, e o
// áudio final é só a emenda das frases na ordem. Sem isso sobraria o problema
// clássico de narrar vídeo pronto — ou a voz atropela a tela, ou a tela fica
// parada esperando a voz.
//
// Roda local, nunca no Vercel: precisa de ffmpeg e de um navegador de verdade.

import { chromium, type Page } from "playwright"
import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs/promises"
import path from "path"
import os from "os"
import crypto from "crypto"
import { gerarNarracao, DIRECAO, type VozId } from "@/lib/content/narracao"

const run = promisify(execFile)

export type Cena = {
  /** O que a voz diz nesta cena. É isto que define quanto ela dura. */
  narracao: string
  /** O que acontece na tela enquanto a frase é dita. */
  acao: (p: Page) => Promise<void>
}

export type Roteiro = {
  nome: string
  base: string
  voz?: VozId
  /** Tom da locução. Padrão: didática (tutorial). */
  direcao?: string
  /** Retrato (vídeo vertical, para Reels e TikTok) em vez de paisagem. */
  vertical?: boolean
  /** Onde o vídeo abre. Sem isto, abre na `base`. */
  inicio?: string
  /** Executado antes da gravação começar (login, por exemplo). Não entra no vídeo. */
  preparar?: (p: Page) => Promise<void>
  cenas: Cena[]
}

const LARGURA = 1280
const ALTURA = 720
// Vertical: 540×960 é 9:16 exato e ainda dispara o layout mobile do site
// (o corte é 768). O ffmpeg dobra no fim, pra sair em 1080×1920.
const LARGURA_V = 540
const ALTURA_V = 960

async function duracaoDe(arquivo: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", arquivo,
  ])
  return parseFloat(stdout.trim())
}

// Ponteiro desenhado na página. O Playwright move o mouse de verdade, mas o
// vídeo gravado NÃO desenha cursor nenhum — sem isto o tutorial vira "coisas
// acontecendo sozinhas", e quem assiste não entende onde clicar.
const CURSOR = `
(() => {
  if (document.getElementById('fm-cursor')) return
  const d = document.createElement('div')
  d.id = 'fm-cursor'
  d.style.cssText = [
    'position:fixed','z-index:2147483647','pointer-events:none',
    'width:22px','height:22px','border-radius:50%',
    'background:rgba(240,25,107,0.35)','border:2px solid #f0196b',
    'transform:translate(-50%,-50%)','transition:opacity .2s','opacity:0',
    'box-shadow:0 0 12px rgba(240,25,107,0.6)',
  ].join(';')
  document.body.appendChild(d)
  addEventListener('mousemove', (e) => {
    d.style.opacity = '1'
    d.style.left = e.clientX + 'px'
    d.style.top = e.clientY + 'px'
  }, true)
  addEventListener('mousedown', (e) => {
    const r = document.createElement('div')
    r.style.cssText = [
      'position:fixed','z-index:2147483646','pointer-events:none',
      'left:' + e.clientX + 'px','top:' + e.clientY + 'px',
      'width:12px','height:12px','border-radius:50%','border:2px solid #f0196b',
      'transform:translate(-50%,-50%)','transition:all .45s ease-out','opacity:1',
    ].join(';')
    document.body.appendChild(r)
    requestAnimationFrame(() => {
      r.style.width = '60px'; r.style.height = '60px'; r.style.opacity = '0'
    })
    setTimeout(() => r.remove(), 500)
  }, true)
})()
`

export async function gravar(roteiro: Roteiro, destino: string) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fiztut-"))
  const voz = roteiro.voz ?? "Kore"

  // ── 1. Narração primeiro, e guardada ────────────────────────────────────
  //
  // O cache existe por uma conta amarga: regravar é o normal (o texto fica, a
  // navegação é que se ajusta), e sem cache cada tentativa custava 12
  // narrações novas. Oito tentativas depois, o teto DIÁRIO do Gemini — 100
  // chamadas — estourou no meio de uma gravação e travou o trabalho por 16
  // horas.
  //
  // A chave é o conteúdo: texto + voz + tom. Mudou a frase, gera de novo;
  // mudou só o roteiro de navegação, reaproveita tudo.
  const direcao = roteiro.direcao ?? DIRECAO.didatica
  const cofre = path.join(os.tmpdir(), "fiztut-narracoes")
  await fs.mkdir(cofre, { recursive: true })

  console.log(`[tutorial] preparando ${roteiro.cenas.length} narrações…`)
  const trechos: { arquivo: string; dur: number }[] = []
  let novas = 0
  for (const [i, cena] of roteiro.cenas.entries()) {
    const chave = crypto.createHash("sha256")
      .update(`${voz}\u0000${direcao}\u0000${cena.narracao}`).digest("hex").slice(0, 32)
    const wav = path.join(cofre, `${chave}.wav`)
    const guardada = await fs.access(wav).then(() => true, () => false)
    if (!guardada) {
      await fs.writeFile(wav, await gerarNarracao(cena.narracao, voz, direcao))
      novas++
    }
    const dur = await duracaoDe(wav)
    trechos.push({ arquivo: wav, dur })
    console.log(`  cena ${i + 1}: ${dur.toFixed(1)}s ${guardada ? "(guardada)" : "(nova)"} — "${cena.narracao.slice(0, 44)}…"`)
  }
  console.log(`[tutorial] ${novas} narração(ões) gerada(s), ${roteiro.cenas.length - novas} reaproveitada(s)`)
  const total = trechos.reduce((a, t) => a + t.dur, 0)
  console.log(`[tutorial] narração total: ${total.toFixed(1)}s`)

  // ── 2. Navegação gravada, no ritmo da narração ──────────────────────────
  const L = roteiro.vertical ? LARGURA_V : LARGURA
  const A = roteiro.vertical ? ALTURA_V : ALTURA

  // `--autoplay-policy`: o vídeo mostra a música tocando, e sem isto o
  // navegador segura o áudio esperando um gesto que a gravação não dá.
  const navegador = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] })

  // Login ANTES de abrir a gravação, num contexto descartável.
  //
  // O Playwright começa a gravar quando o CONTEXTO nasce, não quando a
  // primeira cena roda. Com o `preparar` dentro do contexto gravado, o login
  // e as navegações entravam no vídeo e empurravam tudo pra frente: a
  // narração falava do player enquanto a tela ainda mostrava a lista. O
  // sintoma parecia erro de seletor, e não era.
  //
  // A sessão é levada adiante por `storageState`, que é como o Playwright
  // transporta cookies e localStorage entre contextos.
  let estado: Awaited<ReturnType<typeof contextoLogin.storageState>> | undefined
  var contextoLogin = await navegador.newContext({ viewport: { width: L, height: A }, locale: "pt-BR" })
  if (roteiro.preparar) {
    console.log("[tutorial] preparando (login etc.) — fora do vídeo")
    const pLogin = await contextoLogin.newPage()
    await roteiro.preparar(pLogin)
    estado = await contextoLogin.storageState()
  }
  await contextoLogin.close()

  const contexto = await navegador.newContext({
    ...(estado ? { storageState: estado } : {}),
    viewport: { width: L, height: A },
    recordVideo: { dir: tmp, size: { width: L, height: A } },
    locale: "pt-BR",
    // Movimento reduzido NÃO: as animações da interface fazem parte do que o
    // tutorial está ensinando.
  })
  const pagina = await contexto.newPage()
  // Reinjeta o ponteiro a cada navegação — ele vive no DOM e some com a troca
  // de página.
  await pagina.addInitScript(CURSOR)

  // A sessão já veio pronta (ver `estado` acima): o `preparar` NÃO roda aqui.
  // Primeiro quadro já na tela certa: abrir na home e pular depois faria o
  // vídeo começar num lugar que a narração não menciona.
  await pagina.goto(roteiro.inicio ?? roteiro.base, { waitUntil: "networkidle" })
  await pagina.waitForTimeout(2500)

  const t0 = Date.now()
  let acumulado = 0
  for (const [i, cena] of roteiro.cenas.entries()) {
    console.log(`[tutorial] cena ${i + 1}/${roteiro.cenas.length}`)
    try {
      await cena.acao(pagina)
    } catch (e) {
      // Uma cena que falha não pode derrubar a gravação inteira: o resto do
      // tutorial continua valendo, e o log diz qual revisar.
      console.error(`  ⚠️  cena ${i + 1} falhou: ${e instanceof Error ? e.message : e}`)
    }
    acumulado += trechos[i].dur
    // Espera até o ponto onde a narração desta cena termina. É isto que
    // mantém imagem e voz juntas sem nenhum ajuste manual depois.
    const faltam = acumulado * 1000 - (Date.now() - t0)
    if (faltam > 0) await pagina.waitForTimeout(faltam)
    else console.warn(`  ⚠️  cena ${i + 1} demorou ${Math.round(-faltam)}ms a mais que a narração`)
  }

  // Segura a última tela por um instante: fechar o contexto no mesmo quadro
  // em que a narração acaba deixava um rabo preto no fim do arquivo.
  await pagina.waitForTimeout(900)
  const video = await pagina.video()!.path()
  await contexto.close()
  await navegador.close()

  // ── 3. Junta voz e imagem ───────────────────────────────────────────────
  const lista = path.join(tmp, "vozes.txt")
  await fs.writeFile(lista, trechos.map((t) => `file '${t.arquivo}'`).join("\n"))
  const vozUnica = path.join(tmp, "narracao.wav")
  await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", vozUnica])

  await fs.mkdir(path.dirname(destino), { recursive: true })
  await run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", video, "-i", vozUnica,
    "-map", "0:v", "-map", "1:a",
    // Dobra o vertical para 1080×1920, que é o que as redes esperam.
    ...(roteiro.vertical ? ["-vf", "scale=1080:1920:flags=lanczos"] : []),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k",
    // A gravação costuma passar alguns quadros do fim da narração; corta no
    // áudio pra não terminar com silêncio pendurado.
    "-shortest",
    destino,
  ])

  // Apaga só o material desta gravação. O cofre de narrações sobrevive — é
  // ele que torna a próxima tentativa gratuita.
  await fs.rm(tmp, { recursive: true, force: true })
  const { size } = await fs.stat(destino)
  console.log(`[tutorial] pronto: ${destino} (${(size / 1024 / 1024).toFixed(1)} MB)`)
  return destino
}
