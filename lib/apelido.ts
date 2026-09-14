// Assinatura pública do autor na Rede.
//
// PRIMEIRO nome, não o nome completo: o login é Google e o que vem de lá é o
// nome civil inteiro. "Audrei" entrega a mesma identidade social que "Audrei
// Ligorio" sem publicar registro civil ao lado de uma música que pode se
// chamar "Homenagem para a Mãe" (decisão do Audrei, 2026-09-14).
const MAX = 24

export function apelidoPadrao(nomeCompleto?: string | null, email?: string | null): string | null {
  const primeiro = (nomeCompleto ?? "").trim().split(/\s+/)[0]
  if (primeiro) return capitaliza(primeiro).slice(0, MAX)

  // Sem nome na conta (login por e-mail), o local-part serve de semente:
  // "maria.silva@..." vira "Maria". É palpite, e por isso é editável.
  const local = (email ?? "").split("@")[0]?.split(/[._-]/)[0]
  if (local && /[a-zà-ú]/i.test(local)) return capitaliza(local).slice(0, MAX)

  return null
}

function capitaliza(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
