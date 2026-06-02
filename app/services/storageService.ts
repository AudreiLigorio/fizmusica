import { createServerClient } from "@/lib/supabase"

const BUCKET = "songs"

/**
 * Faz upload de um MP3 para o Supabase Storage.
 * Retorna a URL pública do arquivo.
 */
export async function uploadMp3(
  file: Buffer | Blob,
  fileName: string
): Promise<{ path: string; url: string }> {
  const supabase = createServerClient()

  const filePath = `mp3/${Date.now()}-${fileName}`

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      contentType: "audio/mpeg",
      upsert: false,
    })

  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path)

  return {
    path: data.path,
    url: urlData.publicUrl,
  }
}

/**
 * Deleta um arquivo do Supabase Storage pelo path.
 */
export async function deleteMp3(path: string): Promise<void> {
  const supabase = createServerClient()

  const { error } = await supabase.storage.from(BUCKET).remove([path])

  if (error) throw new Error(`Delete falhou: ${error.message}`)
}
