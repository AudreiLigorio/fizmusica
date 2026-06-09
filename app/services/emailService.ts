import { Resend } from "resend"
import QRCode from "qrcode"

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_ADDRESS = "FizMusica <contato@fizmusica.com.br>"
const ADMIN_EMAIL  = process.env.ADMIN_NOTIFY_EMAIL ?? "contato@fizmusica.com.br"

// ============================================================
// E-mail de entrega da música ao cliente
// ============================================================

interface MusicDeliveryEmailData {
  nome:      string
  email:     string
  musicName: string
  publicUrl: string
  orderId:   string
  mp3Url?:   string | null
}

export async function sendMusicDeliveryEmail(data: MusicDeliveryEmailData): Promise<{ ok: boolean; error?: string }> {
  try {
    // Gera QR Code como PNG base64
    const qrDataUrl = await QRCode.toDataURL(data.publicUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
    // Remove prefixo "data:image/png;base64," para usar como cid embed
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "")

    // Busca MP3 como buffer para anexar (máx 20 MB)
    const attachments: Array<{ filename: string; content: string }> = []
    if (data.mp3Url) {
      try {
        const mp3Res = await fetch(data.mp3Url, { signal: AbortSignal.timeout(15000) })
        if (mp3Res.ok) {
          const buffer = await mp3Res.arrayBuffer()
          const sizeMB = buffer.byteLength / 1024 / 1024
          if (sizeMB <= 20) {
            attachments.push({
              filename: `${data.musicName ?? "musica"}.mp3`.replace(/[^a-zA-Z0-9\-_.áéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ ]/g, "").trim() + ".mp3",
              content:  Buffer.from(buffer).toString("base64"),
            })
          } else {
            console.warn(`[email] MP3 muito grande (${sizeMB.toFixed(1)} MB) — não anexado`)
          }
        }
      } catch (mp3Err) {
        console.warn("[email] Não foi possível baixar o MP3 para anexo:", mp3Err)
      }
    }

    const result = await resend.emails.send({
      from:        FROM_ADDRESS,
      to:          data.email,
      subject:     `🎵 Sua música está pronta, ${data.nome.split(" ")[0]}!`,
      html:        buildDeliveryEmail(data, qrBase64),
      attachments: attachments.length > 0 ? attachments : undefined,
    })

    if ((result as any).error) {
      const msg = (result as any).error?.message ?? JSON.stringify((result as any).error)
      console.error("[email] Resend erro na entrega:", msg)
      return { ok: false, error: msg }
    }
    console.log(`[email] Entrega enviada para ${data.email}`, result)
    return { ok: true }
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    console.error("[email] Falha ao enviar e-mail de entrega:", msg)
    return { ok: false, error: msg }
  }
}

function buildDeliveryEmail(data: MusicDeliveryEmailData, qrBase64: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f0f0f0;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#ec4899,#a855f7);padding:40px 32px;text-align:center">
        <div style="font-size:48px;margin-bottom:12px">🎵</div>
        <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800">Sua música está pronta!</h1>
        <p style="color:rgba(255,255,255,0.85);margin:12px 0 0;font-size:16px">Feita com amor especialmente para você</p>
      </div>

      <div style="padding:40px 32px">
        <p style="font-size:18px;margin:0 0 8px">Olá, <strong>${data.nome.split(" ")[0]}</strong>! ❤️</p>
        <p style="color:#999;margin:0 0 32px">
          Sua música personalizada <strong style="color:#ec4899">"${data.musicName}"</strong> ficou incrível e está pronta para você ouvir!
        </p>

        <div style="text-align:center;margin:32px 0">
          <a href="${data.publicUrl}"
            style="display:inline-block;background:linear-gradient(135deg,#ec4899,#a855f7);color:#fff;text-decoration:none;padding:18px 40px;border-radius:50px;font-size:18px;font-weight:700;box-shadow:0 8px 32px rgba(236,72,153,0.4)">
            ▶ Ouvir minha música
          </a>
        </div>

        <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:20px;text-align:center;margin:24px 0">
          <p style="color:#999;font-size:13px;margin:0 0 12px">📱 Escaneie para ouvir no celular</p>
          <img src="data:image/png;base64,${qrBase64}" alt="QR Code" width="160" height="160"
            style="display:block;margin:0 auto;border-radius:8px;border:4px solid #fff" />
          <p style="color:#666;font-size:11px;margin:12px 0 0;word-break:break-all">
            <a href="${data.publicUrl}" style="color:#ec4899">${data.publicUrl}</a>
          </p>
        </div>

        ${data.mp3Url ? `
        <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:16px;margin:16px 0">
          <p style="color:#999;font-size:13px;margin:0 0 4px">🎧 O arquivo MP3 também está em anexo neste e-mail.</p>
          <p style="color:#666;font-size:11px;margin:0">Salve no seu celular para ouvir sem internet!</p>
        </div>
        ` : ""}

        <p style="color:#666;font-size:14px;margin:24px 0 0">
          Compartilhe com quem quiser — basta enviar o link ou mostrar o QR Code! ❤️
        </p>

        <p style="color:#555;font-size:12px;margin:32px 0 0;padding-top:24px;border-top:1px solid #222">
          Dúvidas? Fale conosco em <a href="mailto:contato@fizmusica.com.br" style="color:#ec4899">contato@fizmusica.com.br</a>
        </p>
      </div>
    </div>
  `
}

interface OrderEmailData {
  orderId: string
  nome: string
  email: string
  whatsapp: string
  context: string
  subcategory: string
  musicalStyle: string
  voiceType: string
  emotion: string
  createdAt: Date
}

export async function sendOrderConfirmationEmail(order: OrderEmailData): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: order.email,
      subject: "Pedido recebido — FizMusica 🎵",
      html: buildClientEmail(order),
    })
    console.log(`[email] Confirmação enviada para ${order.email}`)
  } catch (err) {
    console.error("[email] Falha ao enviar confirmação ao cliente:", err)
  }
}

export async function sendOrderNotificationEmail(order: OrderEmailData): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: ADMIN_EMAIL,
      subject: `Novo pedido #${order.orderId.slice(0, 8)} — ${order.nome}`,
      html: buildAdminEmail(order),
    })
    console.log("[email] Notificação interna enviada")
  } catch (err) {
    console.error("[email] Falha ao enviar notificação interna:", err)
  }
}

function buildClientEmail(order: OrderEmailData): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#7c3aed;padding:32px;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:24px">FizMusica</h1>
        <p style="color:#e9d5ff;margin:8px 0 0">Sua música personalizada está a caminho!</p>
      </div>

      <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p>Olá, <strong>${order.nome}</strong>!</p>
        <p>Recebemos seu pedido com sucesso. Nossa equipe já está trabalhando na sua música especial.</p>

        <div style="background:#f5f3ff;border-left:4px solid #7c3aed;padding:16px;border-radius:4px;margin:24px 0">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Número do pedido</p>
          <p style="margin:0;font-size:18px;font-weight:700;color:#7c3aed;font-family:monospace">#${order.orderId.slice(0, 8).toUpperCase()}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Ocasião</td><td style="padding:8px 0;font-size:14px;font-weight:500">${order.subcategory}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Estilo musical</td><td style="padding:8px 0;font-size:14px;font-weight:500">${order.musicalStyle}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Voz</td><td style="padding:8px 0;font-size:14px;font-weight:500">${order.voiceType}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Emoção</td><td style="padding:8px 0;font-size:14px;font-weight:500">${order.emotion}</td></tr>
        </table>

        <p style="font-size:14px;color:#6b7280">Em breve entraremos em contato pelo WhatsApp <strong>${order.whatsapp}</strong> com mais detalhes.</p>

        <p style="font-size:14px;color:#6b7280;margin-top:32px">Dúvidas? Responda este e-mail ou fale conosco em <a href="mailto:contato@fizmusica.com.br" style="color:#7c3aed">contato@fizmusica.com.br</a></p>
      </div>
    </div>
  `
}

// ============================================================
// Notificação de pagamento confirmado (para o admin)
// ============================================================

interface PaymentNotificationData {
  orderId:      string
  nome:         string
  email:        string
  whatsapp:     string
  subcategory:  string
  musicalStyle: string
  voiceType:    string
  emotion:      string
  honoreeName?: string | null
  createdAt:    string
}

export async function sendNewOrderPaidNotification(order: PaymentNotificationData): Promise<void> {
  const adminUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"}/admin/pedidos/${order.orderId}`

  try {
    await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      ADMIN_EMAIL,
      subject: `💳 Novo pedido PAGO — ${order.nome} (${order.subcategory})`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f0f0f0;border-radius:16px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#ec4899,#a855f7);padding:32px;text-align:center">
            <div style="font-size:40px;margin-bottom:8px">💳✅</div>
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800">Novo pedido pago!</h1>
          </div>

          <div style="padding:32px">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:6px 0;color:#999;width:130px">Pedido</td><td style="padding:6px 0;font-family:monospace;color:#ec4899">#${order.orderId.slice(0, 8).toUpperCase()}</td></tr>
              <tr><td style="padding:6px 0;color:#999">Cliente</td><td style="padding:6px 0;font-weight:600">${order.nome}</td></tr>
              <tr><td style="padding:6px 0;color:#999">E-mail</td><td style="padding:6px 0"><a href="mailto:${order.email}" style="color:#ec4899">${order.email}</a></td></tr>
              <tr><td style="padding:6px 0;color:#999">WhatsApp</td><td style="padding:6px 0">${order.whatsapp}</td></tr>
              ${order.honoreeName ? `<tr><td style="padding:6px 0;color:#999">Homenageado</td><td style="padding:6px 0">${order.honoreeName}</td></tr>` : ""}
              <tr><td style="padding:6px 0;color:#999">Ocasião</td><td style="padding:6px 0">${order.subcategory}</td></tr>
              <tr><td style="padding:6px 0;color:#999">Estilo</td><td style="padding:6px 0">${order.musicalStyle}</td></tr>
              <tr><td style="padding:6px 0;color:#999">Voz</td><td style="padding:6px 0">${order.voiceType}</td></tr>
              <tr><td style="padding:6px 0;color:#999">Emoção</td><td style="padding:6px 0">${order.emotion}</td></tr>
              <tr><td style="padding:6px 0;color:#999">Recebido em</td><td style="padding:6px 0">${new Date(order.createdAt).toLocaleString("pt-BR")}</td></tr>
            </table>

            <div style="text-align:center;margin:28px 0 0">
              <a href="${adminUrl}"
                style="display:inline-block;background:linear-gradient(135deg,#ec4899,#a855f7);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:16px;font-weight:700">
                Ver pedido no painel →
              </a>
            </div>
          </div>
        </div>
      `,
    })
    console.log(`[email] Notificação de pagamento enviada para ${ADMIN_EMAIL}`)
  } catch (err) {
    console.error("[email] Falha ao notificar admin sobre pagamento:", err)
  }
}

function buildAdminEmail(order: OrderEmailData): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <h2 style="color:#7c3aed">Novo pedido recebido</h2>

      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#6b7280;width:140px">ID</td><td style="padding:6px 0;font-family:monospace">${order.orderId}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Nome</td><td style="padding:6px 0">${order.nome}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">E-mail</td><td style="padding:6px 0"><a href="mailto:${order.email}">${order.email}</a></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">WhatsApp</td><td style="padding:6px 0">${order.whatsapp}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Contexto</td><td style="padding:6px 0">${order.context}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Ocasião</td><td style="padding:6px 0">${order.subcategory}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Estilo</td><td style="padding:6px 0">${order.musicalStyle}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Voz</td><td style="padding:6px 0">${order.voiceType}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Emoção</td><td style="padding:6px 0">${order.emotion}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Data</td><td style="padding:6px 0">${order.createdAt.toLocaleString("pt-BR")}</td></tr>
      </table>
    </div>
  `
}
