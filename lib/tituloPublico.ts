// Título neutro de uma música sem nome confirmado.
//
// Existe porque o título que vem do Suno costuma ser o NOME DO HOMENAGEADO
// ("Lucas", "Deus") — dado de terceiro que não consentiu. Sem a confirmação
// do cliente, a música aparece com um rótulo derivado da ocasião.
//
// A composição livre é a exceção, e ela saía quebrada: a subcategoria ali é
// um rótulo de tela ("Já tenho a composição da Letra"), não uma ocasião, e o
// player exibia "Uma canção de Já tenho a composição da Letra". Ficou mais
// visível desde que a porta amarela leva direto pra esse caminho.
export function tituloNeutro(ocasiao?: string | null): string {
  const o = (ocasiao ?? "").trim()
  if (!o || /composi[çc]/i.test(o)) return "Uma canção autoral"
  return `Uma canção de ${o}`
}

// Rótulo PÚBLICO da ocasião (Rede, página da música). Mesma armadilha do
// título: a subcategoria da composição livre é texto de botão do wizard
// ("Já tenho a composição da Letra") e aparecia como se fosse uma ocasião —
// no filtro da Rede e embaixo do nome de cada música. Só troca a exibição;
// o banco e o wizard seguem com o rótulo original.
export function rotuloOcasiao(ocasiao?: string | null): string {
  const o = (ocasiao ?? "").trim()
  if (/composi[çc]/i.test(o)) return "Composição autoral"
  return o
}
