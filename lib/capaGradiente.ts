// Capa de reserva para música sem imagem — entrega antiga (manual) não tem
// capa gerada pelo Suno. O gradiente é estável por id: a mesma música cai
// sempre na mesma cor, então a prateleira não "pisca" cores a cada render
// nem fica um bloco cinza igual pra todas.
const GRADIENTES = [
  "linear-gradient(150deg,#3a1440,#7a1f5c)",
  "linear-gradient(150deg,#1c2f52,#3d1f66)",
  "linear-gradient(150deg,#4a1330,#a3226b)",
  "linear-gradient(150deg,#122b3a,#2c6b6f)",
  "linear-gradient(150deg,#3a2312,#8a4a1f)",
  "linear-gradient(150deg,#241541,#5c1f8a)",
]

export function gradienteDaCapa(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return GRADIENTES[Math.abs(hash) % GRADIENTES.length]
}
