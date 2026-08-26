// Comparação da busca da área do cliente.
//
// Ignora acento de propósito: ninguém digita "aniversário" com acento no
// celular, e sem isso a busca não acha nada — que é pior do que achar demais.
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

// Um campo de busca só, procurando em vários campos do item. Cada palavra
// digitada precisa aparecer em algum lugar ("casamento sertanejo" acha a
// música de casamento em estilo sertanejo, mesmo estando em campos
// diferentes) — busca por frase exata seria frustrante aqui.
//
// `campos` é uma lista pra crescer sem reescrever: quando existir apelido do
// autor, é só acrescentar mais um item na chamada.
export function combina(termo: string, campos: (string | null | undefined)[]): boolean {
  const t = normalizar(termo)
  if (!t) return true
  const alvo = campos.filter(Boolean).map((c) => normalizar(c as string)).join(" ")
  return t.split(/\s+/).every((parte) => alvo.includes(parte))
}
