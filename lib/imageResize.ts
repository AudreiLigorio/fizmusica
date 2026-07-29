import sharp from "sharp"

// Foto de celular chega com 3 a 5 MB e ~4000px de largura. O player mostra ela
// em, no máximo, a largura da tela — o resto é peso puro. Num pedido real de
// 15 fotos isso deu 32 MB de álbum: no 4G, cinco fotos não terminavam de
// baixar dentro dos 6 segundos do slide e o carrossel exibia quadro vazio.
//
// 1600px cobre com folga qualquer tela de celular (mesmo em telas 3x) e sobra
// para o desktop, que exibe a foto dentro de um quadro.
const LARGURA_MAXIMA = 1600
const QUALIDADE = 82

export type FotoOtimizada = {
  bytes: Buffer
  ext: "jpg"
  mime: "image/jpeg"
  bytesAntes: number
  bytesDepois: number
}

/**
 * Reduz a foto para o tamanho que o player realmente usa.
 *
 * `.rotate()` sem argumento é obrigatório e não é detalhe: ele aplica a
 * orientação do EXIF ANTES do resize. Sem isso, foto tirada em pé pelo celular
 * sai deitada — o redimensionamento descarta o EXIF, e a informação de girar
 * se perde junto.
 *
 * Se algo der errado, devolve os bytes originais: entregar a foto pesada é
 * ruim, não entregar a foto do cliente é inaceitável.
 */
export async function otimizarFoto(bytes: Uint8Array): Promise<FotoOtimizada> {
  const original = Buffer.from(bytes)

  try {
    const otimizada = await sharp(original)
      .rotate()
      .resize({ width: LARGURA_MAXIMA, withoutEnlargement: true })
      .jpeg({ quality: QUALIDADE, progressive: true, mozjpeg: true })
      .toBuffer()

    // Foto pequena e já bem comprimida pode "crescer" ao ser reprocessada.
    // Nesse caso o original é melhor.
    if (otimizada.length >= original.length) {
      return { bytes: original, ext: "jpg", mime: "image/jpeg", bytesAntes: original.length, bytesDepois: original.length }
    }

    return {
      bytes: otimizada,
      ext: "jpg",
      mime: "image/jpeg",
      bytesAntes: original.length,
      bytesDepois: otimizada.length,
    }
  } catch (e) {
    console.error("[fotos] falha ao otimizar, mantendo original:", e instanceof Error ? e.message : e)
    return { bytes: original, ext: "jpg", mime: "image/jpeg", bytesAntes: original.length, bytesDepois: original.length }
  }
}
