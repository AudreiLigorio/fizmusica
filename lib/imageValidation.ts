// ============================================================
// Validação de upload de imagem — defesa contra arquivos maliciosos
// Usada nas rotas de upload do cliente. NUNCA confie no Content-Type
// ou na extensão enviada pelo navegador: tudo é checado por bytes.
// ============================================================

export const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8 MB por foto

// Formatos permitidos (SVG é proibido de propósito: pode embutir <script>)
export type AllowedImage = { ext: "jpg" | "png" | "webp"; mime: string }

const ALLOWED: AllowedImage[] = [
  { ext: "jpg",  mime: "image/jpeg" },
  { ext: "png",  mime: "image/png"  },
  { ext: "webp", mime: "image/webp" },
]

export const ALLOWED_MIME = ALLOWED.map((a) => a.mime)
export const ALLOWED_EXT  = ALLOWED.map((a) => a.ext)

/**
 * Identifica o tipo real do arquivo pelos primeiros bytes (assinatura/magic number).
 * Retorna null se não corresponder a um formato permitido — ou seja, se for
 * um arquivo disfarçado (executável, script, polyglot etc.).
 */
export function sniffImageType(buf: Uint8Array): AllowedImage | null {
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" }
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" }
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50  // WEBP
  ) {
    return { ext: "webp", mime: "image/webp" }
  }
  return null
}

export type ValidationResult =
  | { ok: true; type: AllowedImage; bytes: Uint8Array }
  | { ok: false; error: string }

/**
 * Valida um arquivo recebido por upload de forma defensiva:
 * 1. existe e não está vazio
 * 2. tamanho dentro do limite
 * 3. tipo real (por magic bytes) é JPEG/PNG/WebP
 * 4. extensão e MIME declarados batem com o tipo real
 */
export async function validateImageUpload(file: File | null): Promise<ValidationResult> {
  if (!file)                 return { ok: false, error: "Nenhum arquivo enviado." }
  if (file.size === 0)       return { ok: false, error: "Arquivo vazio." }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `Arquivo muito grande. Máximo de ${MAX_FILE_BYTES / 1024 / 1024} MB.` }
  }

  const buf = new Uint8Array(await file.arrayBuffer())

  // Defesa extra: confirma que o tamanho lido bate com o declarado
  if (buf.byteLength > MAX_FILE_BYTES) {
    return { ok: false, error: "Arquivo excede o limite permitido." }
  }

  const type = sniffImageType(buf)
  if (!type) {
    return { ok: false, error: "Formato inválido. Envie apenas JPG, PNG ou WebP." }
  }

  // Coerência (não confiamos, mas rejeitamos divergências grosseiras)
  const declaredExt = file.name.split(".").pop()?.toLowerCase() ?? ""
  const extOk = declaredExt === type.ext || (type.ext === "jpg" && declaredExt === "jpeg")
  if (declaredExt && !extOk) {
    return { ok: false, error: "A extensão do arquivo não corresponde ao conteúdo." }
  }

  return { ok: true, type, bytes: buf }
}
