// RASCUNHO das locuções, com a voz do macOS — para conferir texto e ritmo.
//
// Existe por causa do teto diário do Gemini TTS (100 por dia): quando ele
// estoura, a espera é de horas, e revisar um texto no escuro é pior que
// ouvi-lo numa voz feia. Aqui o `say` do sistema lê as MESMAS frases
// (importadas de `textos-venda.ts`), de graça e na hora.
//
// NÃO É PARA PUBLICAR. A voz é sintética de um jeito que se nota na primeira
// sílaba. Serve para aprovar o conteúdo e cronometrar; a peça que vai ao ar
// sai de `audios-venda.ts`.
//
//   npx tsx scripts/tutoriais/audios-venda-rascunho.ts

import { RAIZ } from "./ambiente"
import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { PECAS } from "./textos-venda"

const run = promisify(execFile)

// Vozes pt-BR do sistema, em ordem de preferência. `say -v '?'` lista o que
// está instalado; Luciana é a mais antiga e a mais previsível das brasileiras.
const VOZES = ["Luciana", "Sandy (Português (Brasil))", "Flo (Português (Brasil))"]

const SAIDA = path.join(RAIZ, "scripts/tutoriais/saida")

async function vozDisponivel(): Promise<string> {
  const { stdout } = await run("say", ["-v", "?"])
  for (const v of VOZES) if (stdout.includes(v.split(" ")[0])) return v
  throw new Error("Nenhuma voz pt-BR instalada no sistema (veja `say -v '?'`).")
}

async function duracao(arq: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", arq,
  ])
  return parseFloat(stdout.trim())
}

async function main() {
  const voz = await vozDisponivel()
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fizrascunho-"))
  await fs.mkdir(SAIDA, { recursive: true })
  console.log(`[rascunho] voz do sistema: ${voz}\n`)

  for (const peca of PECAS) {
    const aiff = path.join(tmp, "v.aiff")
    // `-r 185`: um pouco acima do padrão. A locução de venda da peça final é
    // adiantada, e o rascunho só serve para cronometrar se o ritmo bater.
    await run("say", ["-v", voz, "-r", "185", "-o", aiff, peca.texto])

    const destino = path.join(SAIDA, peca.arquivo.replace(/\.mp3$/, "-RASCUNHO.mp3"))
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", aiff,
      "-codec:a", "libmp3lame", "-b:a", "128k", "-ac", "1", destino])

    const d = await duracao(destino)
    console.log(`${path.basename(destino).padEnd(30)} ${d.toFixed(0)}s — ${peca.titulo}`)
  }

  await fs.rm(tmp, { recursive: true, force: true })
  console.log(`\nSão rascunhos. A versão para publicar sai de audios-venda.ts.`)
}

main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e)
  process.exit(1)
})
