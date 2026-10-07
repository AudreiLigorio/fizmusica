// Motivos de denúncia de música da Rede — compartilhado entre o modal (tela)
// e a API, para os dois nunca aceitarem listas diferentes. A chave é o que vai
// para o banco; o rótulo é o que a pessoa lê e o que chega no e-mail do admin.
export const MOTIVOS_DENUNCIA = [
  { id: "odio", rotulo: "Letra ofensiva, ódio ou preconceito" },
  { id: "sexual", rotulo: "Conteúdo sexual ou impróprio" },
  { id: "pessoa", rotulo: "Usa nome ou imagem de alguém sem autorização" },
  { id: "direitos", rotulo: "Cópia de outra música (direitos autorais)" },
  { id: "outro", rotulo: "Outro motivo" },
] as const

export type MotivoDenuncia = (typeof MOTIVOS_DENUNCIA)[number]["id"]

export function rotuloMotivo(id: string): string | null {
  return MOTIVOS_DENUNCIA.find((m) => m.id === id)?.rotulo ?? null
}
