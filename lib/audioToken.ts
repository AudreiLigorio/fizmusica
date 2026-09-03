import { createHmac, timingSafeEqual } from "crypto"

// Prova de que quem pede o áudio já foi autenticado como dono do pedido.
//
// Por que existe: a autorização do dono em /api/audio dependia do header
// `Authorization: Bearer`, e um <audio src="..."> NÃO manda header nenhum —
// o navegador busca aquela URL como qualquer imagem. Resultado: depois que o
// bucket foi fechado, música que não está na Rede (pedido ainda em produção,
// ou cliente que não autorizou publicação) devolvia 404 e o player mostrava
// "Erro". Regressão minha, irmã da que quebrou os players do admin.
//
// A saída é levar a credencial na PRÓPRIA URL. Quem emite é /api/orders, que
// já confere quem está pedindo; /api/audio só confere a assinatura.
//
// Não guarda nada no banco: o token carrega o que precisa (pedido + validade)
// e a assinatura impede que qualquer um dos dois seja alterado.

const PREFIXO = "audio.v1"

// Namespace no início da mensagem: o segredo é o mesmo do admin, e sem isto
// um token de um lado poderia, em tese, ser aproveitado no outro.
function segredo(): string {
  return process.env.ADMIN_SECRET ?? "fizmusica_dev_secret"
}

function assinar(mensagem: string): string {
  return createHmac("sha256", segredo()).update(mensagem).digest("hex")
}

// 6 horas: o token só precisa sobreviver à sessão de quem abriu a área do
// cliente e clicou em tocar depois de um tempo. Curto o bastante pra um link
// copiado não valer amanhã; longo o bastante pra não expirar com a aba
// aberta — que é exatamente o que aconteceria se ele durasse os 30 min da
// URL assinada do arquivo.
const VALIDADE_MS = 6 * 60 * 60 * 1000

export function criarTokenAudio(orderId: string): string {
  const expira = Date.now() + VALIDADE_MS
  return `${expira}.${assinar(`${PREFIXO}:${orderId}:${expira}`)}`
}

export function tokenAudioValido(token: string | null, orderId: string): boolean {
  if (!token) return false
  const [expiraTexto, assinatura] = token.split(".")
  if (!expiraTexto || !assinatura) return false

  const expira = Number(expiraTexto)
  if (!Number.isFinite(expira) || Date.now() > expira) return false

  // O orderId entra na mensagem: token de um pedido não abre outro.
  const esperada = assinar(`${PREFIXO}:${orderId}:${expira}`)
  if (esperada.length !== assinatura.length) return false
  return timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))
}
