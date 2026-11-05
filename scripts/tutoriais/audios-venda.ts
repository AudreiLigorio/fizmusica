// Gera as três locuções de venda em MP3, com a voz boa (Gemini TTS).
//
// Os textos vivem em `textos-venda.ts`, compartilhados com o rascunho.
//
//   npx tsx scripts/tutoriais/audios-venda.ts

// Primeiro de todos: povoa process.env antes dos módulos que o leem.
import { RAIZ } from "./ambiente"
import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs/promises"
import path from "path"
import os from "os"
import crypto from "crypto"
import { gerarNarracao, DIRECAO, type VozId } from "@/lib/content/narracao"

const run = promisify(execFile)
const VOZ: VozId = "Kore"
// Ancorado na raiz do projeto, não no diretório de quem chama: rodado de
// outra pasta, o script criava uma árvore `scripts/tutoriais/saida` solta lá.
const SAIDA = path.join(RAIZ, "scripts/tutoriais/saida")

import { PECAS } from "./textos-venda"

async function duracao(arq: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", arq,
  ])
  return parseFloat(stdout.trim())
}

async function main() {
  // Mesmo cofre da gravação de vídeo: refazer uma peça não gasta cota de
  // novo, e o teto diário do Gemini já travou o trabalho uma vez.
  const cofre = path.join(os.tmpdir(), "fiztut-narracoes")
  await fs.mkdir(cofre, { recursive: true })
  await fs.mkdir(SAIDA, { recursive: true })

  for (const peca of PECAS) {
    const chave = crypto.createHash("sha256")
      .update(`${VOZ}\u0000${DIRECAO.entusiasmada}\u0000${peca.texto}`).digest("hex").slice(0, 32)
    const wav = path.join(cofre, `${chave}.wav`)
    const guardada = await fs.access(wav).then(() => true, () => false)

    if (!guardada) {
      await fs.writeFile(wav, await gerarNarracao(peca.texto, VOZ, DIRECAO.entusiasmada))
    }

    const destino = path.join(SAIDA, peca.arquivo)
    // 192k mono: é voz, não música — bitrate maior só engorda o arquivo.
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", wav,
      "-codec:a", "libmp3lame", "-b:a", "192k", "-ac", "1", destino])

    const d = await duracao(destino)
    const { size } = await fs.stat(destino)
    console.log(`${peca.arquivo}  ${d.toFixed(0)}s  ${(size / 1024).toFixed(0)} KB  ${guardada ? "(reaproveitada)" : "(nova)"}  — ${peca.titulo}`)
  }
}

main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e)
  process.exit(1)
})
