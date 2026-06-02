import { NextResponse } from "next/server"
import { uploadMp3 } from "@/app/services/storageService"

// Rota de teste — remover após validação
export async function GET() {
  try {
    // Cria um arquivo de áudio mínimo válido (MP3 silencioso de 1 segundo)
    const silentMp3 = Buffer.from(
      "fffb9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "hex"
    )

    const result = await uploadMp3(silentMp3, "teste-validacao.mp3")

    return NextResponse.json({
      success: true,
      path: result.path,
      url: result.url,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
