// Três locuções de venda, em MP3 — sem vídeo. O Audrei monta as telas.
//
// O que cada uma diz foi conferido contra o banco em 05/11/2026, porque
// áudio de venda que promete o que o plano não entrega é o mesmo furo que já
// apareceu três vezes nos textos da tela:
//
//   Essencial    R$  9,90   0 fotos   sem QR   sem ajustes
//   Pacote 10    R$ 49,90   0 fotos   sem QR   sem ajustes
//   Retrospect.  R$ 69,90  15 fotos   SEM QR   SEM ajustes
//   Premium      R$ 99,90  25 fotos   com QR   com ajustes
//
// Por isso o QR Code e os ajustes são atribuídos à PREMIUM, nunca à
// Retrospectiva em geral.
//
//   npx tsx scripts/tutoriais/audios-venda.ts

// Primeiro de todos: povoa process.env antes dos módulos que o leem.
import "./ambiente"
import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs/promises"
import path from "path"
import os from "os"
import crypto from "crypto"
import { gerarNarracao, DIRECAO, type VozId } from "@/lib/content/narracao"

const run = promisify(execFile)
const VOZ: VozId = "Kore"
const SAIDA = "scripts/tutoriais/saida"

const PECAS: { arquivo: string; titulo: string; texto: string }[] = [
  {
    arquivo: "01-produtos.mp3",
    titulo: "Os produtos e a diferença entre eles",
    texto:
      "Na Fiz Música, uma história vira música de verdade. E existem dois caminhos. " +
      "Se é pra presentear alguém, as Retrospectivas: a música sai junto com as fotos de vocês, " +
      "sincronizadas, e vira uma experiência pra pessoa assistir e guardar. " +
      "Se é pra você, a música avulsa: a sua história, a sua letra, a voz que você escolher. " +
      "E serve pra qualquer momento. Aniversário de namoro. Casamento. " +
      "Anunciar uma gravidez cantando, em vez de contar. Homenagear os avós. " +
      "Ou a sua composição autoral, aquela que até hoje só existiu na sua cabeça. " +
      "E tem mais: depois de pronta, você pode publicar a sua música no SpotFiz, de graça, " +
      "e deixar todo mundo ouvir o que você criou.",
  },
  {
    arquivo: "02-retrospectiva.mp3",
    titulo: "A Retrospectiva por dentro",
    texto:
      "A Retrospectiva é a música com as fotos de vocês dentro dela. Funciona assim. " +
      "Você conta a história e a letra é escrita com você. Antes de qualquer coisa ser gravada, " +
      "você lê, ajusta, troca uma palavra, aprova. A letra é sua. " +
      "Depois a música chega em duas versões. Você ouve as duas com calma e escolhe a que te emocionou. " +
      "Aí você envia as fotos. Elas aparecem passando no ritmo da música, na ordem que você montar, " +
      "com a letra acompanhando na tela. " +
      "E a entrega é um link exclusivo, feito pra pessoa homenageada. " +
      "Ela abre no celular e vê tudo: a capa, as fotos, a música tocando. " +
      "Na versão Premium você ainda leva um cartão com QR Code pra entregar na mão. " +
      "A pessoa aponta a câmera e a música começa ali, na frente de todo mundo. " +
      "E a Premium também inclui ajustes, se depois de ouvir você quiser mudar alguma coisa.",
  },
  {
    arquivo: "03-como-criar.mp3",
    titulo: "Como criar a sua música",
    texto:
      "Criar a sua música leva poucos minutos, e é mais simples do que parece. " +
      "Primeiro você escolhe a ocasião. Um pedido de namoro, o aniversário da sua mãe, " +
      "uma homenagem ao seu pet, ou uma composição sua, do zero. " +
      "Depois a gente faz algumas perguntas sobre a história. Como vocês se conheceram. " +
      "Aquela mania que só ela tem. O que não pode faltar na letra. " +
      "Você digita, ou aperta o microfone e fala — do jeito que for mais fácil. " +
      "Então você escolhe o estilo: sertanejo, pagode, gospel, rock, o que combinar com a pessoa. " +
      "A voz, masculina ou feminina. E a emoção que a música tem que ter. " +
      "E aqui vem a melhor parte: antes de pagar qualquer coisa, " +
      "você já lê o refrão da sua música, escrito ali, com a sua história dentro. " +
      "Gostou? Aprova a letra e, em minutos, a música está pronta pra você ouvir. " +
      "A sua história merece virar música. Começa agora.",
  },
]

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
