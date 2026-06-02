"use client"

import { QRCodeSVG } from "qrcode.react"

export default function TesteQRPage() {
  const url = "https://fizmusica.com.br/musica/exemplo-123"

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-950 text-white">
      <h1 className="text-2xl font-bold">Teste QR Code</h1>
      <p className="text-gray-400 text-sm">{url}</p>
      <div className="bg-white p-4 rounded-xl">
        <QRCodeSVG value={url} size={200} />
      </div>
      <p className="text-green-400 text-sm">✓ QR Code gerado com sucesso</p>
    </div>
  )
}
