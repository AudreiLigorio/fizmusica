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

// ============================================================
// E-mail: pagamento confirmado → acesse a área (status + fotos)
// ============================================================

interface PaymentConfirmedEmailData {
  nome:    string
  email:   string
  areaUrl: string
}

export async function sendPaymentConfirmedEmail(data: PaymentConfirmedEmailData): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      data.email,
      subject: `✅ Pagamento confirmado, ${data.nome.split(" ")[0]}! Acompanhe sua música`,
      html:    buildPaymentConfirmedEmail(data),
    })
    if ((result as any).error) {
      const msg = (result as any).error?.message ?? JSON.stringify((result as any).error)
      console.error("[email] Resend erro no e-mail de pagamento confirmado:", msg)
      return { ok: false, error: msg }
    }
    console.log(`[email] Pagamento confirmado enviado para ${data.email}`)
    return { ok: true }
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    console.error("[email] Falha ao enviar e-mail de pagamento confirmado:", msg)
    return { ok: false, error: msg }
  }
}

function buildPaymentConfirmedEmail(data: PaymentConfirmedEmailData): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f0f0f0;border-radius:16px;overflow:hidden">
      <div style="background-color:#c026d3;background-image:linear-gradient(135deg,#ec4899,#a855f7);padding:40px 32px;text-align:center">
        <div style="font-size:48px;margin-bottom:12px">✅</div>
        <h1 style="color:#fff;margin:0;font-size:26px;font-weight:bold">Pagamento confirmado!</h1>
        <p style="color:#ffffff;margin:12px 0 0;font-size:16px">Sua música já entrou na fila de produção</p>
      </div>

      <div style="padding:40px 32px">
        <p style="font-size:18px;margin:0 0 8px">Olá, <strong>${data.nome.split(" ")[0]}</strong>! ❤️</p>
        <p style="color:#999;margin:0 0 24px">
          Recebemos seu pagamento com sucesso. Agora você tem uma <strong>área exclusiva</strong> onde pode
          <strong style="color:#ec4899">acompanhar o status da criação</strong> e <strong style="color:#ec4899">cadastrar todas as suas fotos</strong>,
          que vão aparecer no player junto da música.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto">
          <tr><td align="center" bgcolor="#ec4899" style="border-radius:50px">
            <a href="${data.areaUrl}" style="display:inline-block;padding:16px 40px;color:#fff;text-decoration:none;font-family:sans-serif;font-size:16px;font-weight:bold;border-radius:50px">
              Acessar minha área
            </a>
          </td></tr>
        </table>

        <div style="background:#2a1015;border:1px solid #5b2230;border-radius:12px;padding:16px;margin:8px 0 0">
          <p style="color:#f6a7c6;font-size:14px;margin:0;font-weight:bold">⏱ Dica importante</p>
          <p style="margin:6px 0 0;font-size:13px;color:#d8a9b6">
            Quanto antes você cadastrar as fotos, melhor — elas entram na produção junto com a música. Se deixar pra depois, podem não dar tempo de entrar.
          </p>
        </div>

        <p style="color:#888;font-size:13px;margin:24px 0 0">
          Na área você entra <strong>sem senha</strong> — com sua conta Google ou um link enviado para o seu e-mail.
        </p>

        <p style="color:#555;font-size:12px;margin:28px 0 0;padding-top:24px;border-top:1px solid #222">
          Dúvidas? Fale conosco em <a href="mailto:contato@fizmusica.com.br" style="color:#ec4899">contato@fizmusica.com.br</a>
        </p>
      </div>
    </div>
  `
}

// ============================================================
// E-mail: alerta de possível pagamento duplicado (para o admin)
// ============================================================

interface DuplicatePaymentAlertData {
  orderId:             string
  nome?:               string
  mpPaymentId:         string
  previousMpPaymentId: string
  amount?:             number
}

export async function sendDuplicatePaymentAlert(data: DuplicatePaymentAlertData): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      ADMIN_EMAIL,
      subject: `⚠️ Possível pagamento duplicado — pedido ${data.orderId.slice(0, 8).toUpperCase()}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#b91c1c">⚠️ Possível pagamento duplicado</h2>
          <p>Chegou um pagamento aprovado para um pedido que <strong>já estava pago</strong>, com um ID diferente. Verifique no Mercado Pago e estorne se for cobrança em duplicidade.</p>
          <table style="border-collapse:collapse;font-size:14px">
            <tr><td style="padding:4px 8px;color:#666">Pedido</td><td style="padding:4px 8px"><strong>${data.orderId.slice(0, 8).toUpperCase()}</strong> (${data.orderId})</td></tr>
            ${data.nome ? `<tr><td style="padding:4px 8px;color:#666">Cliente</td><td style="padding:4px 8px">${data.nome}</td></tr>` : ""}
            <tr><td style="padding:4px 8px;color:#666">Pagamento já registrado</td><td style="padding:4px 8px">${data.previousMpPaymentId}</td></tr>
            <tr><td style="padding:4px 8px;color:#666">Novo pagamento (duplicado?)</td><td style="padding:4px 8px"><strong style="color:#b91c1c">${data.mpPaymentId}</strong></td></tr>
            ${data.amount ? `<tr><td style="padding:4px 8px;color:#666">Valor</td><td style="padding:4px 8px">R$ ${Number(data.amount).toFixed(2).replace(".", ",")}</td></tr>` : ""}
          </table>
          <p style="margin-top:16px"><a href="https://www.mercadopago.com.br/activities/1/detail?id=${data.mpPaymentId}" style="color:#2563eb">Abrir transação no Mercado Pago ↗</a></p>
        </div>
      `,
    })
    if ((result as any).error) return { ok: false, error: (result as any).error?.message ?? "erro" }
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
}

// ============================================================
// E-mail: confirmação de reivindicação de pedido (e-mail divergente)
// ============================================================

interface ClaimEmailData {
  email:      string
  code:       string
  confirmUrl: string
}

export async function sendClaimConfirmationEmail(data: ClaimEmailData): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      data.email,
      subject: `Confirme que o pedido ${data.code} é seu — FizMusica`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#f0f0f0;border-radius:16px;overflow:hidden">
          <div style="background-color:#c026d3;background-image:linear-gradient(135deg,#ec4899,#a855f7);padding:32px;text-align:center">
            <div style="font-size:36px">🔗</div>
            <h1 style="color:#fff;margin:8px 0 0;font-size:22px;font-weight:bold">Vincular pedido à sua conta</h1>
          </div>
          <div style="padding:32px">
            <p style="color:#999;margin:0 0 24px">
              Alguém (provavelmente você) pediu para vincular o pedido <strong style="color:#ec4899">${data.code}</strong> a uma conta do FizMusica. Se foi você, confirme abaixo. O pedido passará a aparecer na sua área.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
              <tr><td align="center" bgcolor="#ec4899" style="border-radius:50px">
                <a href="${data.confirmUrl}" style="display:inline-block;padding:15px 36px;color:#fff;text-decoration:none;font-family:sans-serif;font-size:15px;font-weight:bold;border-radius:50px">
                  Confirmar e vincular
                </a>
              </td></tr>
            </table>
            <p style="color:#666;font-size:12px;margin:24px 0 0">Se você não fez esse pedido, ignore este e-mail — nada será vinculado.</p>
          </div>
        </div>
      `,
    })
    if ((result as any).error) return { ok: false, error: (result as any).error?.message ?? "erro" }
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
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

// ============================================================
// E-mail de recuperação de abandono do wizard (lead capturado)
// ============================================================

interface WizardAbandonmentEmailData {
  nome:        string
  email:       string
  subcategory: string
  musicalStyle?: string
  sessionId:   string
}

export async function sendWizardAbandonmentEmail(data: WizardAbandonmentEmailData): Promise<{ ok: boolean; error?: string }> {
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"
  const resumeUrl = `${siteUrl}/criar?sessao=${data.sessionId}`
  try {
    const result = await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      data.email,
      subject: `${data.nome.split(" ")[0]}, sua música especial ainda não está pronta 🎵`,
      html: buildWizardAbandonmentEmail(data, resumeUrl),
    })
    if ((result as any).error) {
      const msg = (result as any).error?.message ?? JSON.stringify((result as any).error)
      return { ok: false, error: msg }
    }
    console.log(`[email] Recuperação wizard enviada para ${data.email}`)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
}

function buildWizardAbandonmentEmail(data: WizardAbandonmentEmailData, resumeUrl: string): string {
  const firstName = data.nome.split(" ")[0]
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f0f0f0;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#ec4899,#a855f7);padding:40px 32px;text-align:center">
        <div style="font-size:48px;margin-bottom:12px">🎵</div>
        <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800">Sua história ainda está aqui!</h1>
        <p style="color:rgba(255,255,255,0.85);margin:12px 0 0;font-size:15px">Você começou a criar algo especial</p>
      </div>
      <div style="padding:40px 32px">
        <p style="font-size:18px;margin:0 0 8px">Olá, <strong>${firstName}</strong>! ❤️</p>
        <p style="color:#999;margin:0 0 16px">
          Você começou a criar uma música de <strong style="color:#ec4899">${data.subcategory}</strong>${data.musicalStyle ? ` no estilo <strong style="color:#ec4899">${data.musicalStyle}</strong>` : ""} mas não finalizou o pedido.
        </p>
        <p style="color:#999;margin:0 0 32px">Suas respostas ficaram salvas — é só clicar abaixo para continuar de onde parou!</p>

        <div style="text-align:center;margin:32px 0">
          <a href="${resumeUrl}"
            style="display:inline-block;background:linear-gradient(135deg,#ec4899,#a855f7);color:#fff;text-decoration:none;padding:18px 40px;border-radius:50px;font-size:17px;font-weight:700;box-shadow:0 8px 32px rgba(236,72,153,0.4)">
            🎵 Continuar minha música
          </a>
        </div>

        <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:16px 20px;margin:24px 0">
          <p style="color:#777;font-size:13px;margin:0 0 8px">🔒 Suas respostas foram preservadas</p>
          <p style="color:#555;font-size:12px;margin:0">O link acima recarrega exatamente de onde você parou, em qualquer dispositivo.</p>
        </div>

        <p style="color:#555;font-size:12px;margin:32px 0 0;padding-top:24px;border-top:1px solid #222">
          Dúvidas? Fale conosco em <a href="mailto:contato@fizmusica.com.br" style="color:#ec4899">contato@fizmusica.com.br</a>
        </p>
      </div>
    </div>
  `
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
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"
  const paymentUrl = `${siteUrl}/produtos?orderId=${order.orderId}`
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

        <!-- Botão de pagamento -->
        <div style="text-align:center;margin:32px 0">
          <a href="${paymentUrl}"
            style="display:inline-block;background:linear-gradient(135deg,#ec4899,#a855f7);color:#fff;text-decoration:none;padding:16px 36px;border-radius:50px;font-size:16px;font-weight:700;box-shadow:0 6px 24px rgba(124,58,237,0.35)">
            💳 Ir para o pagamento →
          </a>
          <p style="font-size:12px;color:#9ca3af;margin:10px 0 0">Clique para escolher o produto e finalizar seu pedido</p>
        </div>

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
              <tr><td style="padding:6px 0;color:#999">Recebido em</td><td style="padding:6px 0">${new Date(order.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td></tr>
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
        <tr><td style="padding:6px 0;color:#6b7280">Data</td><td style="padding:6px 0">${order.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td></tr>
      </table>
    </div>
  `
}

// ============================================================
// E-mail de recuperação de pedido não pago (repescagem)
// ============================================================

interface RecoveryEmailData {
  nome:         string
  email:        string
  subcategory:  string
  musicalStyle: string
  orderId:      string
}

export async function sendRecoveryEmail(data: RecoveryEmailData): Promise<{ ok: boolean; error?: string }> {
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"
  try {
    const result = await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      data.email,
      subject: `${data.nome.split(" ")[0]}, sua música ainda está esperando por você 🎵`,
      html: buildRecoveryEmail(data, siteUrl),
    })
    if ((result as any).error) {
      const msg = (result as any).error?.message ?? JSON.stringify((result as any).error)
      return { ok: false, error: msg }
    }
    console.log(`[email] Recuperação enviada para ${data.email}`)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
}

function buildRecoveryEmail(data: RecoveryEmailData, siteUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f0f0f0;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#ec4899,#a855f7);padding:40px 32px;text-align:center">
        <div style="font-size:48px;margin-bottom:12px">🎵</div>
        <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800">Sua música está esperando!</h1>
        <p style="color:rgba(255,255,255,0.85);margin:12px 0 0;font-size:15px">Você começou um pedido e não finalizou</p>
      </div>
      <div style="padding:40px 32px">
        <p style="font-size:18px;margin:0 0 8px">Olá, <strong>${data.nome.split(" ")[0]}</strong>! ❤️</p>
        <p style="color:#999;margin:0 0 24px">
          Notamos que você iniciou um pedido de <strong style="color:#ec4899">${data.subcategory}</strong>
          no estilo <strong style="color:#ec4899">${data.musicalStyle}</strong>, mas não concluiu o pagamento.
        </p>
        <p style="color:#999;margin:0 0 32px">Sua música personalizada pode ser criada especialmente para você — basta finalizar o pedido!</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${siteUrl}/criar"
            style="display:inline-block;background:linear-gradient(135deg,#ec4899,#a855f7);color:#fff;text-decoration:none;padding:18px 40px;border-radius:50px;font-size:17px;font-weight:700;box-shadow:0 8px 32px rgba(236,72,153,0.4)">
            🎵 Finalizar meu pedido
          </a>
        </div>
        <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:16px;margin:24px 0;text-align:center">
          <p style="color:#666;font-size:13px;margin:0 0 4px">Dúvidas? Fale com a gente no WhatsApp</p>
          <a href="https://wa.me/5511996645678" style="color:#ec4899;font-size:14px;font-weight:600">📱 (11) 99664-5678</a>
        </div>
        <p style="color:#555;font-size:12px;margin:32px 0 0;padding-top:24px;border-top:1px solid #222">
          Se não quiser mais receber e-mails da FizMusica, ignore esta mensagem.
        </p>
      </div>
    </div>
  `
}

// ============================================================
// E-mail de solicitação de avaliação (NPS / feedback pós-entrega)
// ============================================================

interface FeedbackRequestEmailData {
  nome:        string
  email:       string
  musicName:   string
  feedbackUrl: string
}

export async function sendFeedbackRequestEmail(data: FeedbackRequestEmailData): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      data.email,
      subject: `${data.nome.split(" ")[0]}, o que você achou da sua música? 🎵`,
      html: buildFeedbackRequestEmail(data),
    })
    if ((result as any).error) {
      const msg = (result as any).error?.message ?? JSON.stringify((result as any).error)
      console.error("[email] Feedback request erro:", msg)
      return { ok: false, error: msg }
    }
    console.log(`[email] Solicitação de feedback enviada para ${data.email}`)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
}

function buildFeedbackRequestEmail(data: FeedbackRequestEmailData): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f0f0f0;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#ec4899,#a855f7);padding:40px 32px;text-align:center">
        <div style="font-size:48px;margin-bottom:12px">💜</div>
        <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800">O que você achou?</h1>
        <p style="color:rgba(255,255,255,0.85);margin:12px 0 0;font-size:15px">Sua opinião faz toda a diferença pra nós!</p>
      </div>
      <div style="padding:40px 32px">
        <p style="font-size:18px;margin:0 0 8px">Olá, <strong>${data.nome.split(" ")[0]}</strong>! 🎵</p>
        <p style="color:#999;margin:0 0 8px">
          Sua música <strong style="color:#ec4899">"${data.musicName}"</strong> foi entregue e esperamos que tenha ficado incrível!
        </p>
        <p style="color:#999;margin:0 0 32px">
          Queremos saber o que você achou — leva menos de 2 minutos e nos ajuda muito a continuar criando músicas especiais.
        </p>

        <div style="text-align:center;margin:32px 0">
          <a href="${data.feedbackUrl}"
            style="display:inline-block;background:linear-gradient(135deg,#ec4899,#a855f7);color:#fff;text-decoration:none;padding:18px 40px;border-radius:50px;font-size:17px;font-weight:700;box-shadow:0 8px 32px rgba(236,72,153,0.4)">
            ⭐ Avaliar minha música
          </a>
        </div>

        <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:16px 20px;margin:24px 0">
          <p style="color:#888;font-size:13px;margin:0 0 6px">3 perguntinhas rápidas:</p>
          <p style="color:#ccc;font-size:13px;margin:4px 0">⭐ Nota geral de 1 a 5 estrelas</p>
          <p style="color:#ccc;font-size:13px;margin:4px 0">💬 O que te emocionou na música</p>
          <p style="color:#ccc;font-size:13px;margin:4px 0">🔧 Sugestão de melhoria (opcional)</p>
        </div>

        <p style="color:#555;font-size:12px;margin:32px 0 0;padding-top:24px;border-top:1px solid #222;text-align:center">
          FizMusica — Músicas personalizadas feitas com amor ❤️<br>
          <a href="https://fizmusica.com.br" style="color:#ec4899">fizmusica.com.br</a>
        </p>
      </div>
    </div>
  `
}

// ============================================================
// E-mail em massa (admin envia para base de clientes)
// ============================================================

interface MassEmailRecipient { nome: string; email: string }

export async function sendMassEmail(recipients: MassEmailRecipient[], subject: string, body: string): Promise<{ sent: number; failed: number; errors: string[] }> {
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"
  let sent = 0, failed = 0
  const errors: string[] = []

  for (const r of recipients) {
    try {
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f0f0f0;border-radius:16px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#ec4899,#a855f7);padding:24px 32px;text-align:center">
            <span style="color:#fff;font-size:20px;font-weight:800">FizMusica ❤️</span>
          </div>
          <div style="padding:32px">
            <p style="font-size:16px;margin:0 0 20px">Olá, <strong>${r.nome.split(" ")[0]}</strong>!</p>
            <div style="color:#ccc;line-height:1.8;white-space:pre-wrap">${body}</div>
            <div style="text-align:center;margin:32px 0">
              <a href="${siteUrl}" style="display:inline-block;background:linear-gradient(135deg,#ec4899,#a855f7);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:700">
                🎵 Visitar FizMusica
              </a>
            </div>
            <p style="color:#555;font-size:11px;margin:24px 0 0;padding-top:16px;border-top:1px solid #222;text-align:center">
              FizMusica — Músicas personalizadas feitas com amor ❤️
            </p>
          </div>
        </div>
      `
      const result = await resend.emails.send({ from: FROM_ADDRESS, to: r.email, subject, html })
      if ((result as any).error) { failed++; errors.push(`${r.email}: ${(result as any).error?.message}`) }
      else sent++
    } catch (err: any) {
      failed++; errors.push(`${r.email}: ${err?.message ?? "erro desconhecido"}`)
    }
    await new Promise(res => setTimeout(res, 50))
  }

  console.log(`[email] Massa: ${sent} enviados, ${failed} falharam`)
  return { sent, failed, errors }
}
