"use client"

import { QRCodeSVG } from "qrcode.react"

export default function QRModal({ url, onClose }: { url: string; onClose: () => void }) {
  function handlePrint() {
    const qrSvg = document.getElementById("qr-modal-card")?.querySelector("svg")?.outerHTML ?? ""
    const win = window.open("", "_blank", "width=480,height=720")
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>QR Code - FizMúsica</title>
    <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @media print { body { margin: 0; } }
      body { background: #EDE0D4; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: 'EB Garamond', Georgia, serif; }
      .card { background: #FBF5EE; border-radius: 18px; border: 2px dashed #C8B99A; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 44px 40px; width: 360px; min-height: 500px; gap: 8px; }
      .sep { display: flex; align-items: center; gap: 10px; color: #B8963E; }
      .sep-line { display: block; height: 1px; width: 30px; background: #B8963E; }
      .title { color: #2C2216; font-size: 30px; text-align: center; line-height: 1.35; margin: 4px 0; }
      .subtitle { color: #B8963E; font-style: italic; font-size: 20px; margin: 4px 0 8px; }
      .qr-box { border: 2px solid #C8B99A; border-radius: 12px; padding: 18px; background: #fff; display: flex; align-items: center; justify-content: center; }
      .footer { display: flex; flex-direction: column; align-items: center; gap: 3px; margin-top: 4px; }
      .heart-outline { font-size: 20px; color: transparent; -webkit-text-stroke: 1.5px #B8963E; }
      .brand { color: #2C2216; letter-spacing: .2em; font-size: 11px; font-family: sans-serif; font-weight: 700; }
      .tagline { color: #9A8A76; letter-spacing: .12em; font-size: 9px; font-family: sans-serif; }
    </style></head><body>
    <div class="card">
      <div class="sep"><span class="sep-line"></span><span>♥</span><span class="sep-line"></span></div>
      <p class="title">Existe algo que<br>eu gostaria de<br>te dizer.</p>
      <div class="sep"><span class="sep-line"></span><span>♥</span><span class="sep-line"></span></div>
      <p class="subtitle">Escaneie e descubra.</p>
      <div class="qr-box">${qrSvg}</div>
      <div class="footer">
        <span class="heart-outline">♡</span>
        <p class="brand">FIZMÚSICA</p>
        <p class="tagline">SUA HISTÓRIA. SUA MÚSICA.</p>
      </div>
    </div>
    <script>window.onload=()=>{ setTimeout(()=>{ window.print(); window.close() }, 800) }<\/script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
        <div
          id="qr-modal-card"
          className="w-full bg-[#FBF5EE] rounded-2xl border-2 border-dashed border-[#C8B99A]/50 flex flex-col items-center justify-between py-10 px-8"
          style={{ minHeight: 480 }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="block h-px w-8 bg-[#B8963E]" /><span className="text-[#B8963E] text-xl">♥</span><span className="block h-px w-8 bg-[#B8963E]" />
            </div>
            <p className="text-[#2C2216] text-center font-serif leading-snug" style={{ fontSize: "1.5rem" }}>
              Existe algo que<br />eu gostaria de<br />te dizer.
            </p>
            <div className="flex items-center gap-3">
              <span className="block h-px w-8 bg-[#B8963E]" /><span className="text-[#B8963E] text-xl">♥</span><span className="block h-px w-8 bg-[#B8963E]" />
            </div>
            <p className="text-[#B8963E] italic text-lg font-serif">Escaneie e descubra.</p>
          </div>
          <div className="my-6 border-2 border-[#C8B99A] rounded-xl p-5 bg-white flex items-center justify-center">
            <QRCodeSVG value={url} size={150} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B8963E" strokeWidth="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <p className="text-[#2C2216] tracking-[0.2em] text-xs font-semibold mt-1">FIZMÚSICA</p>
            <p className="text-[#9A8A76] tracking-widest text-[10px]">SUA HISTÓRIA. SUA MÚSICA.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-[#B8963E] hover:bg-[#9A7D35] text-white px-6 py-3 rounded-2xl text-sm font-semibold transition-all"
          >
            🖨️ Imprimir
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 bg-white/10 border border-white/20 hover:bg-white/20 text-white px-5 py-3 rounded-2xl text-sm transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
