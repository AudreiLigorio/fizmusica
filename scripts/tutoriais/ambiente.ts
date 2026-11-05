// Carrega o .env.local antes de qualquer coisa, venha de onde vier a chamada.
//
// Duas armadilhas, nesta ordem:
//
// 1. O `next` carrega o .env.local sozinho; um script solto rodado por `tsx`
//    não. Sem isto era preciso lembrar de `set -a && . ./.env.local && set +a`
//    antes, e esquecer dava "GEMINI_API_KEY não configurada" com a chave ali
//    o tempo todo.
//
// 2. Resolver pelo `process.cwd()` parecia resolver, mas só funciona quando o
//    comando parte da raiz do projeto. Rodado de outra pasta, o arquivo não é
//    encontrado e o erro volta idêntico — foi o que aconteceu com o Audrei
//    depois do primeiro conserto. Agora a raiz é descoberta subindo a partir
//    do PRÓPRIO script até achar o package.json, então o diretório de quem
//    chama deixa de importar.
import { config } from "dotenv"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

function raizDoProjeto(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir
    const acima = path.dirname(dir)
    if (acima === dir) break
    dir = acima
  }
  // Último recurso: o diretório atual, que é o comportamento de antes.
  return process.cwd()
}

export const RAIZ = raizDoProjeto()

// `.env.local` tem precedência, como no Next; `.env` entra como base.
// `quiet`: sem isto o dotenv imprime um banner de dica a cada execução.
config({ path: path.join(RAIZ, ".env.local"), quiet: true })
config({ path: path.join(RAIZ, ".env"), quiet: true })

// Falhar aqui, com o caminho na mensagem, é muito melhor que falhar lá na
// frente com "chave não configurada" — que manda procurar no lugar errado.
if (!process.env.GEMINI_API_KEY) {
  console.warn(
    `[ambiente] GEMINI_API_KEY não encontrada. Procurei em ${path.join(RAIZ, ".env.local")}`,
  )
}
