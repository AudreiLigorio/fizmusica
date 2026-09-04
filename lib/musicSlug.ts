import { randomBytes } from "crypto"

// Slug do link público /m/{slug}.
//
// Vivia duplicado em duas rotas (entrega manual e escolha de versão do Suno),
// as duas com a MESMA falha — e corrigir só uma teria deixado o caminho que
// mais roda hoje ainda quebrado.
//
// A versão anterior era `primeiros 8 hex do orderId` + 4 caracteres de
// Math.random(). Dois problemas, medidos em 2026-09-04:
//
// 1. O orderId NÃO é segredo: /api/catalog entrega o de toda música da Rede,
//    inclusive pra visitante sem conta. Dos 12 caracteres do slug, 8 vinham
//    de graça e só 4 eram desconhecidos — 36^4 = 1.679.616 tentativas, ~56
//    min em paralelo. E /m/{slug} responde 200 ou 404, oráculo perfeito pra
//    saber quando acertou.
// 2. Math.random() não é criptográfico; não serve de credencial.
//
// Isso importa porque o slug é a ÚNICA credencial das fotos do cliente
// (/api/foto?f=...&slug=...). Adivinhar o slug é ver as fotos de alguém.
//
// Agora: 16 caracteres de crypto puro, sem relação nenhuma com o pedido.
// Alfabeto sem vogais (evita palavra acidental) e sem 0/O e 1/l (evita erro
// ao ditar ou copiar à mão).
const ALFABETO = "0123456789bcdfghjkmnpqrstvwxyz"

export function gerarSlugMusica(): string {
  const bytes = randomBytes(16)
  let out = ""
  for (const b of bytes) out += ALFABETO[b % ALFABETO.length]
  return out
}
