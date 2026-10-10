// Dois nomes de playlist são "o mesmo" se só mudam maiúsculas, acentos ou
// espaços: "Rock", " rock " e "Róck" viram a mesma coisa pra quem lê a lista.
// Usado na tela (aviso na hora) e no servidor (recusa) — uma regra só.
export function normalizarNomePlaylist(nome: string): string {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
}

export function mesmoNomePlaylist(a: string, b: string): boolean {
  return normalizarNomePlaylist(a) === normalizarNomePlaylist(b)
}
