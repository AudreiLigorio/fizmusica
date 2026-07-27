// Invariantes do conteúdo de divulgação. Existem porque a regra "foto de
// cliente nunca entra em peça de marketing" é jurídica, não estética: está
// fora da Autorização de Publicação (documento 07, item 2) e o cliente
// confirmou que é proibido. Regra escrita em markdown orienta a IA; isto aqui
// impede a máquina, mesmo que alguém mude o código sem saber da regra.

/** Buckets cujo conteúdo JAMAIS pode ir parar numa peça pública. */
const BUCKETS_PROIBIDOS = ["order-photos"]

export function ehMidiaDeCliente(url: string | null | undefined): boolean {
  if (!url) return false
  return BUCKETS_PROIBIDOS.some((b) => url.includes(`/${b}/`))
}

/**
 * Barra qualquer mídia que venha do acervo do cliente. Chamado antes de
 * publicar e antes de montar vídeo — os dois pontos em que um arquivo vira
 * peça pública.
 */
export function garantirMidiaPropria(urls: (string | null | undefined)[], contexto: string): void {
  const proibida = urls.find(ehMidiaDeCliente)
  if (proibida) {
    throw new Error(
      `${contexto}: esta mídia é uma foto enviada pelo cliente e não pode ser usada em conteúdo de ` +
      `divulgação — está fora da Autorização de Publicação. Use imagem criada pela própria pipeline.`,
    )
  }
}
