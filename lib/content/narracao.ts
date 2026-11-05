// Narração por voz sintética. Usa a MESMA chave do Gemini que já move a letra
// e o roteirista (modelo TTS da API do Gemini) — sem serviço novo, sem
// credencial nova, sem custo de assinatura.
//
// A API devolve PCM cru (audio/L16, 24 kHz, mono). Empacotamos em WAV aqui
// mesmo, com um cabeçalho de 44 bytes escrito na mão: é formato simples,
// universalmente aceito pelo ffmpeg, e evita depender de conversor externo
// dentro do serverless.

const MODELO_TTS = "gemini-2.5-flash-preview-tts"

/** Vozes pt-BR que soam bem em peça emocional (nomes da API do Gemini). */
export const VOZES = [
  { id: "Kore", label: "Kore — feminina, firme e calorosa" },
  { id: "Aoede", label: "Aoede — feminina, suave" },
  { id: "Charon", label: "Charon — masculina, grave" },
  { id: "Puck", label: "Puck — masculina, leve" },
] as const

export type VozId = (typeof VOZES)[number]["id"]

function wavFromPcm(pcm: Buffer, sampleRate = 24000, channels = 1, bits = 16): Buffer {
  const header = Buffer.alloc(44)
  const byteRate = (sampleRate * channels * bits) / 8
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write("WAVE", 8)
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16) // tamanho do bloco fmt
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE((channels * bits) / 8, 32) // block align
  header.writeUInt16LE(bits, 34)
  header.write("data", 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

/** Direções de interpretação. O modelo de TTS recebe atuação pelo próprio texto. */
export const DIRECAO = {
  // Peça de marketing — era a única que existia, e segue sendo o padrão.
  emocional: "Narre com emoção contida e ritmo pausado, como num comercial sensível:",
  // Tutorial: quem está assistindo quer entender, não se emocionar. Ritmo
  // normal e tom de quem explica ao lado, senão o vídeo fica arrastado e a
  // pessoa pula.
  didatica: "Narre de forma clara e amigável, em ritmo natural, como quem explica a um amigo o que está aparecendo na tela:",
  // Peça de divulgação curta (Reels, TikTok). Ritmo adiantado e voz acesa —
  // vídeo vertical disputa atenção com o polegar, e narração arrastada perde
  // antes do terceiro segundo. Não é grito: é entusiasmo de quem gosta do que
  // está mostrando.
  entusiasmada: "Narre com energia e ritmo acelerado, em tom de locução publicitária animada, como quem apresenta algo que adora e quer que a pessoa experimente agora:",
} as const

export async function gerarNarracao(
  texto: string,
  voz: VozId = "Kore",
  direcao: string = DIRECAO.emocional,
  tentativa = 0,
): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada — necessária para a narração.")
  if (!texto.trim()) throw new Error("Escreva o texto da narração.")

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_TTS}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // A instrução de interpretação vai no próprio texto: é assim que o
        // modelo de TTS recebe direção de atuação.
        contents: [{ parts: [{ text: `${direcao} ${texto}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } },
        },
      }),
    },
  )

  const json = await res.json()

  // 429 — teto de 10 chamadas por minuto no TTS. Uma peça de 12 cenas estoura
  // isso em sequência, e a falha vinha no meio da gravação, depois de já ter
  // gastado as 10 primeiras. A própria resposta diz quanto esperar, então a
  // espera é a que o Google pediu, não um palpite.
  if (res.status === 429 && tentativa < 3) {
    const pedido = JSON.stringify(json).match(/retry in ([\d.]+)s/i)?.[1]
    const espera = (pedido ? parseFloat(pedido) : 20) + 1
    console.warn(`[narracao] limite por minuto atingido — esperando ${espera.toFixed(0)}s`)
    await new Promise((r) => setTimeout(r, espera * 1000))
    return gerarNarracao(texto, voz, direcao, tentativa + 1)
  }

  if (!res.ok || json.error) {
    throw new Error(`Falha na narração: ${json.error?.message ?? res.statusText}`)
  }

  const part = json?.candidates?.[0]?.content?.parts?.[0]
  const b64 = part?.inlineData?.data ?? part?.inline_data?.data
  if (!b64) throw new Error("O modelo não retornou áudio de narração.")

  return wavFromPcm(Buffer.from(b64, "base64"))
}
