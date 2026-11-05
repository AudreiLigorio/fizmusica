// Carrega o .env.local antes de qualquer coisa.
//
// O `next` carrega esse arquivo sozinho; um script solto rodado por `tsx`
// não. Sem isto, rodar os scripts daqui exigia lembrar de
// `set -a && . ./.env.local && set +a` antes — e esquecer disso dava um erro
// que parecia falta de chave ("GEMINI_API_KEY não configurada") quando a
// chave estava ali o tempo todo.
//
// Importar este módulo PRIMEIRO, antes dos imports que leem process.env.
import { config } from "dotenv"
import path from "path"

// `.env.local` tem precedência, como no Next; `.env` entra como base.
// `quiet`: sem isto o dotenv imprime um banner de dica a cada execução, que
// polui a saída dos scripts.
config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true })
config({ path: path.resolve(process.cwd(), ".env"), quiet: true })
