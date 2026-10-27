"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"

const CROP_SIZE   = 480  // px do canvas de edição (UI leve)
const OUTPUT_SIZE = 1440 // px do arquivo exportado (nitidez no player, evita quadriculado)

// Modal de crop quadrado (arrastar + zoom). Compartilhado entre a página de fotos
// (/pedido/[token]/fotos) e o painel inline de fotos (/minha-musica).
export default function PhotoCropModal({
  src,
  onConfirm,
  onCancel,
}: {
  src: string
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef    = useRef<HTMLImageElement | null>(null)
  const stateRef  = useRef({ scale: 1, ox: 0, oy: 0, dragging: false, lastX: 0, lastY: 0, lastDist: 0 })
  const [ready, setReady] = useState(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext("2d")!
    const s   = stateRef.current
    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE)
    const w = img.naturalWidth  * s.scale
    const h = img.naturalHeight * s.scale
    ctx.drawImage(img, s.ox + (CROP_SIZE - w) / 2, s.oy + (CROP_SIZE - h) / 2, w, h)
  }, [])

  useEffect(() => {
    const img  = new Image()
    img.src    = src
    img.onload = () => {
      imgRef.current = img
      const s = stateRef.current
      s.scale = Math.max(CROP_SIZE / img.naturalWidth, CROP_SIZE / img.naturalHeight)
      s.ox = 0; s.oy = 0
      setReady(true)
      setTimeout(draw, 0)
    }
  }, [src, draw])

  function clamp(s: typeof stateRef.current) {
    const img = imgRef.current!
    const w   = img.naturalWidth  * s.scale
    const h   = img.naturalHeight * s.scale
    const minOx = CROP_SIZE - w - (CROP_SIZE - w) / 2
    const maxOx = -(CROP_SIZE - w) / 2
    const minOy = CROP_SIZE - h - (CROP_SIZE - h) / 2
    const maxOy = -(CROP_SIZE - h) / 2
    s.ox = Math.max(Math.min(s.ox, maxOx), minOx)
    s.oy = Math.max(Math.min(s.oy, maxOy), minOy)
  }

  // Quantas unidades do canvas vale 1 pixel arrastado na tela.
  //
  // O canvas tem 480 de buffer mas agora é EXIBIDO menor (ver o `style` do
  // container). Somar o delta do dedo direto em `ox` fazia a foto correr mais
  // que o dedo — num celular de 360px, 1,45x mais. Já era assim antes desta
  // mudança, porque `maxWidth: 100%` também encolhia o canvas; só ficava mais
  // disfarçado.
  function fator() {
    const l = canvasRef.current?.getBoundingClientRect().width
    return l ? CROP_SIZE / l : 1
  }

  function onMouseDown(e: React.MouseEvent) {
    const s = stateRef.current
    s.dragging = true; s.lastX = e.clientX; s.lastY = e.clientY
  }
  function onMouseMove(e: React.MouseEvent) {
    const s = stateRef.current
    if (!s.dragging) return
    const f = fator()
    s.ox += (e.clientX - s.lastX) * f; s.oy += (e.clientY - s.lastY) * f
    s.lastX = e.clientX; s.lastY = e.clientY
    clamp(s); draw()
  }
  function onMouseUp() { stateRef.current.dragging = false }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const s = stateRef.current
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    s.scale = Math.max(s.scale * delta, Math.max(CROP_SIZE / imgRef.current!.naturalWidth, CROP_SIZE / imgRef.current!.naturalHeight))
    clamp(s); draw()
  }

  function onTouchStart(e: React.TouchEvent) {
    const s = stateRef.current
    if (e.touches.length === 1) {
      s.dragging = true; s.lastX = e.touches[0].clientX; s.lastY = e.touches[0].clientY
    } else if (e.touches.length === 2) {
      s.lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    const s = stateRef.current
    if (e.touches.length === 1 && s.dragging) {
      const f = fator()
      s.ox += (e.touches[0].clientX - s.lastX) * f; s.oy += (e.touches[0].clientY - s.lastY) * f
      s.lastX = e.touches[0].clientX; s.lastY = e.touches[0].clientY
      clamp(s); draw()
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
      if (s.lastDist) {
        const ratio = dist / s.lastDist
        const minScale = Math.max(CROP_SIZE / imgRef.current!.naturalWidth, CROP_SIZE / imgRef.current!.naturalHeight)
        s.scale = Math.max(s.scale * ratio, minScale)
        clamp(s); draw()
      }
      s.lastDist = dist
    }
  }
  function onTouchEnd() { stateRef.current.dragging = false; stateRef.current.lastDist = 0 }

  function handleConfirm() {
    const img = imgRef.current
    if (!img) return
    // Reexporta a MESMA moldura num canvas de alta resolução (não usa o canvas de 480).
    const f      = OUTPUT_SIZE / CROP_SIZE
    const out    = document.createElement("canvas")
    out.width    = OUTPUT_SIZE
    out.height   = OUTPUT_SIZE
    const ctx    = out.getContext("2d")!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    const s = stateRef.current
    const w = img.naturalWidth  * s.scale
    const h = img.naturalHeight * s.scale
    ctx.drawImage(
      img,
      (s.ox + (CROP_SIZE - w) / 2) * f,
      (s.oy + (CROP_SIZE - h) / 2) * f,
      w * f,
      h * f,
    )
    out.toBlob((blob) => { if (blob) onConfirm(blob) }, "image/jpeg", 0.95)
  }

  // Em PORTAL no <body>.
  //
  // O modal é montado dentro do painel de fotos, que por sua vez vive dentro
  // do cartão do pedido. Qualquer ancestral com `transform`, `filter` ou
  // `isolate` cria um contexto de empilhamento, e aí o `z-[60]` passa a valer
  // só dentro daquele ancestral — a barra de abas do celular (`z-40`, na raiz)
  // pode desenhar POR CIMA do modal. Foi o que apareceu no relato do Audrei:
  // a barra inteira, colorida e nítida, sobre um fundo que deveria cobri-la.
  // No body não há ancestral nenhum pra prender o modal.
  const conteudo = (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4">
      {/* `max-h-full` + `overflow-y-auto`: rede de segurança. Se um aparelho
          muito baixo ainda não couber, o cartão rola — em vez de cortar os
          botões sem deixar alcançá-los, que é o que acontecia (o
          `justify-center` empurra o excesso pros dois lados e nada rola). */}
      <div className="bg-[#15131d] rounded-3xl overflow-hidden overflow-y-auto max-h-full w-full max-w-sm">
        <div className="px-5 pt-5 pb-2 text-center">
          <p className="font-bold text-lg">Ajustar foto</p>
          <p className="text-white/40 text-sm mt-1">Arraste para reposicionar · Pinça para zoom</p>
        </div>

        {/* Quadrado que CABE na tela, em vez de 480x480 fixos.
            Eram 480 de altura cravados: com o cabeçalho e os botões, o cartão
            dava 638px — medido. Na web mobile de um iPhone SE sobram ~553px
            de área útil depois da barra do navegador, então os 76px dos
            botões ficavam inteiramente fora da tela.
            `aspectRatio` no lugar de `height` mantém o quadrado enquanto a
            largura encolhe; antes só a largura obedecia ao `maxWidth` e o
            recorte deixava de ser quadrado no celular.
            O 16rem reserva cabeçalho (~80), botões (~76) e as margens. */}
        <div className="relative mx-auto overflow-hidden"
             style={{ width: `min(${CROP_SIZE}px, 100%, calc(100dvh - 16rem))`, aspectRatio: "1", touchAction: "none" }}>
          <canvas
            ref={canvasRef}
            width={CROP_SIZE}
            height={CROP_SIZE}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <svg className="absolute inset-0 pointer-events-none w-full h-full" viewBox="0 0 3 3">
            <line x1="1" y1="0" x2="1" y2="3" stroke="rgba(255,255,255,0.2)" strokeWidth="0.02" />
            <line x1="2" y1="0" x2="2" y2="3" stroke="rgba(255,255,255,0.2)" strokeWidth="0.02" />
            <line x1="0" y1="1" x2="3" y2="1" stroke="rgba(255,255,255,0.2)" strokeWidth="0.02" />
            <line x1="0" y1="2" x2="3" y2="2" stroke="rgba(255,255,255,0.2)" strokeWidth="0.02" />
          </svg>
        </div>

        <div className="flex gap-2 p-4">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border border-white/10 text-white/60 hover:text-white transition-colors text-sm">
            Cancelar
          </button>
          <button onClick={handleConfirm}
            className="flex-1 py-3 rounded-2xl font-bold text-sm text-white transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}>
            Usar esta foto ✓
          </button>
        </div>
      </div>
    </div>
  )

  // `document` só existe no cliente; no servidor não renderiza nada.
  return typeof document === "undefined" ? null : createPortal(conteudo, document.body)
}
