import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_ADDRESS = "FizMusica <contato@fizmusica.com.br>"
const ADMIN_EMAIL  = process.env.ADMIN_NOTIFY_EMAIL ?? "contato@fizmusica.com.br"
// Alerta operacional de "música pronta pra liberar" (modo com aprovação). Vai pro
// e-mail pessoal por padrão; override por env se quiser mudar sem mexer no código.
const ADMIN_REVIEW_EMAIL = process.env.ADMIN_REVIEW_EMAIL ?? "audreiligorio@gmail.com"

// ============================================================
// Layout padrão dos e-mails (marca FizMusica)
// - header com gradiente rosa/roxo + cor sólida de reserva (Gmail apaga gradiente)
// - botão "à prova de e-mail" (tabela + bgcolor)
// - rodapé padrão
// ============================================================
function emailShell(o: {
  emoji: string
  title: string
  subtitle?: string
  body: string
  button?: { text: string; url: string }
  afterButton?: string
  note?: { label?: string; text: string }
}): string {
  return `
  <div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f0f0f0;border-radius:16px;overflow:hidden">
    <div style="background-color:#c026d3;background-image:linear-gradient(135deg,#ec4899,#a855f7);padding:38px 32px;text-align:center">
      <div style="font-size:44px;line-height:1;margin-bottom:10px">${o.emoji}</div>
      <h1 style="color:#ffffff;margin:0;font-size:25px;font-weight:bold;line-height:1.25">${o.title}</h1>
      ${o.subtitle ? `<p style="color:#ffffff;margin:10px 0 0;font-size:15px;opacity:0.9">${o.subtitle}</p>` : ""}
    </div>
    <div style="padding:36px 32px">
      ${o.body}
      ${o.button ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto">
        <tr><td align="center" bgcolor="#ec4899" style="border-radius:50px">
          <a href="${o.button.url}" style="display:inline-block;padding:16px 40px;color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;border-radius:50px">${o.button.text}</a>
        </td></tr>
      </table>` : ""}
      ${o.afterButton ?? ""}
      ${o.note ? `
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:16px 18px;margin:20px 0">
        ${o.note.label ? `<p style="color:#f6a7c6;font-size:13px;margin:0 0 6px;font-weight:bold">${o.note.label}</p>` : ""}
        <p style="color:#aaaaaa;font-size:13px;margin:0;line-height:1.6">${o.note.text}</p>
      </div>` : ""}
      <p style="color:#666666;font-size:12px;margin:30px 0 0;padding-top:22px;border-top:1px solid #222222;text-align:center;line-height:1.7">
        <strong style="color:#ec4899">FizMusica</strong> — Sua história, sua música ❤️<br>
        Dúvidas? <a href="mailto:contato@fizmusica.com.br" style="color:#ec4899">contato@fizmusica.com.br</a> · <a href="https://fizmusica.com.br" style="color:#ec4899">fizmusica.com.br</a>
      </p>
    </div>
  </div>`
}

const para = (html: string) => `<p style="color:#bbbbbb;font-size:15px;line-height:1.7;margin:0 0 16px">${html}</p>`
const strong = (text: string) => `<strong style="color:#ec4899">${text}</strong>`
const adminRows = (rows: [string, string][]) =>
  `<table style="width:100%;border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="padding:7px 0;color:#888;font-size:14px;width:130px;vertical-align:top">${k}</td><td style="padding:7px 0;font-size:14px;color:#eee">${v}</td></tr>`)
    .join("")}</table>`

// ============================================================
// E-mail de entrega da música ao cliente
// ============================================================

interface MusicDeliveryEmailData {
  nome:      string
  email:     string
  musicName: string
  areaUrl:   string
  orderId:   string
  loyaltyCoupon?: { code: string; label: string } | null
}

export async function sendMusicDeliveryEmail(data: MusicDeliveryEmailData): Promise<{ ok: boolean; error?: string }> {
  try {
    // Acesso (ouvir/baixar/QR) acontece só na área do cliente, após aceite do
    // Termo de Entrega Digital — por isso o e-mail não traz player, QR nem MP3.
    const result = await resend.emails.send({
      from:        FROM_ADDRESS,
      to:          data.email,
      subject:     `🎵 Sua música está pronta, ${data.nome.split(" ")[0]}!`,
      html:        buildDeliveryEmail(data),
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

function buildDeliveryEmail(data: MusicDeliveryEmailData): string {
  const afterButton = `
    ${para("Na sua área você poderá ouvir, baixar o MP3 e gerar o QR Code para compartilhar — basta confirmar o termo de entrega.")}
    ${data.loyaltyCoupon ? `
    <div style="margin:24px 0;padding:18px;border:2px dashed #a855f7;border-radius:14px;background:rgba(168,85,247,0.08);text-align:center">
      <p style="margin:0 0 6px;color:#d8b4fe;font-size:13px;font-weight:bold">🎁 ${data.loyaltyCoupon.label} NA SUA PRÓXIMA MÚSICA</p>
      <p style="margin:0 0 4px;font-size:24px;font-weight:800;color:#fff;font-family:monospace;letter-spacing:.1em">${data.loyaltyCoupon.code}</p>
      <p style="margin:0;color:#cbd5e1;font-size:12px">Que tal surpreender outra pessoa especial? Use este código no checkout.</p>
    </div>` : ""}`
  return emailShell({
    emoji: "🎵",
    title: "Sua música está pronta!",
    subtitle: "Feita com amor especialmente para você",
    body:
      para(`Olá, ${strong(data.nome.split(" ")[0])}! ❤️`) +
      para(`Sua música personalizada ${strong(`"${data.musicName}"`)} ficou incrível! Acesse sua área para ouvi-la, baixar e compartilhar.`),
    button: { text: "🎵 Acessar minha música", url: data.areaUrl },
    afterButton,
  })
}

// ============================================================
// E-mail: pagamento confirmado → acesse a área (status + fotos)
// ============================================================

interface PaymentConfirmedEmailData {
  nome:    string
  email:   string
  prepUrl: string
}

export async function sendPaymentConfirmedEmail(data: PaymentConfirmedEmailData): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      data.email,
      subject: `✅ Pagamento confirmado, ${data.nome.split(" ")[0]}! Falta aprovar sua letra`,
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
  return emailShell({
    emoji: "✍️",
    title: "Falta 1 passo: aprovar sua letra",
    subtitle: "Sua música só começa depois da sua aprovação",
    body:
      para(`Olá, ${strong(data.nome.split(" ")[0])}! ❤️`) +
      para(`Recebemos seu pagamento com sucesso. Agora falta você ${strong("aprovar a letra")} e, se quiser, ${strong("adicionar fotos")} ao player — é rapidinho e ${strong("não precisa de senha")}.`),
    button: { text: "✍️ Aprovar minha letra", url: data.prepUrl },
    note: {
      label: "⚠️ Importante",
      text: "Sua música não começa sozinha — ela só entra em produção depois que você aprovar a letra. Leva só um minutinho.",
    },
    afterButton: para(`Depois de aprovar, geramos a música automaticamente e avisamos por e-mail assim que ficar pronta.`),
  })
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
      subject: `[Admin] ⚠️ Possível pagamento duplicado — pedido ${data.orderId.slice(0, 8).toUpperCase()}`,
      html: emailShell({
        emoji: "⚠️",
        title: "Possível pagamento duplicado",
        body:
          para("Chegou um pagamento aprovado para um pedido que <strong>já estava pago</strong>, com um ID diferente. Verifique no Mercado Pago e estorne se for cobrança em duplicidade.") +
          adminRows([
            ["Pedido", `<strong style="color:#ec4899">#${data.orderId.slice(0, 8).toUpperCase()}</strong>`],
            ...(data.nome ? [["Cliente", data.nome] as [string, string]] : []),
            ["Já registrado", `<span style="font-family:monospace">${data.previousMpPaymentId}</span>`],
            ["Novo (duplicado?)", `<span style="font-family:monospace;color:#f87171">${data.mpPaymentId}</span>`],
            ...(data.amount ? [["Valor", `R$ ${Number(data.amount).toFixed(2).replace(".", ",")}`] as [string, string]] : []),
          ]),
        button: { text: "Abrir transação no Mercado Pago ↗", url: `https://www.mercadopago.com.br/activities/1/detail?id=${data.mpPaymentId}` },
      }),
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
      html: emailShell({
        emoji: "🔗",
        title: "Vincular pedido à sua conta",
        body:
          para(`Alguém (provavelmente você) pediu para vincular o pedido ${strong(data.code)} a uma conta do FizMusica. Se foi você, confirme abaixo — o pedido passará a aparecer na sua área.`),
        button: { text: "Confirmar e vincular", url: data.confirmUrl },
        note: { text: "Se você não fez esse pedido, ignore este e-mail — nada será vinculado." },
      }),
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
  return emailShell({
    emoji: "🎵",
    title: "Sua história ainda está aqui!",
    subtitle: "Você começou a criar algo especial",
    body:
      para(`Olá, ${strong(firstName)}! ❤️`) +
      para(`Você começou a criar uma música de ${strong(data.subcategory)}${data.musicalStyle ? ` no estilo ${strong(data.musicalStyle)}` : ""}, mas não finalizou o pedido.`) +
      para("Suas respostas ficaram salvas — é só clicar abaixo para continuar de onde parou!"),
    button: { text: "🎵 Continuar minha música", url: resumeUrl },
    note: { label: "🔒 Suas respostas foram preservadas", text: "O link acima recarrega exatamente de onde você parou, em qualquer dispositivo." },
  })
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
      subject: `[Admin] Novo pedido #${order.orderId.slice(0, 8).toUpperCase()} — ${order.nome}`,
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
  const detailsRow = (k: string, v: string) =>
    `<tr><td style="padding:7px 0;color:#888;font-size:14px">${k}</td><td style="padding:7px 0;font-size:14px;font-weight:500;color:#eee;text-align:right">${v}</td></tr>`
  return emailShell({
    emoji: "🎵",
    title: "Pedido recebido!",
    subtitle: "Sua música personalizada está a caminho",
    body:
      para(`Olá, ${strong(order.nome)}! ❤️`) +
      para("Recebemos seu pedido com sucesso. Falta só finalizar o pagamento para nossa equipe começar a produção.") +
      `<div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:14px 18px;margin:18px 0">
        <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.06em">Número do pedido</p>
        <p style="margin:0;font-size:18px;font-weight:bold;color:#ec4899;font-family:monospace">#${order.orderId.slice(0, 8).toUpperCase()}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:8px 0">
        ${detailsRow("Ocasião", order.subcategory)}
        ${detailsRow("Estilo musical", order.musicalStyle)}
        ${detailsRow("Voz", order.voiceType)}
        ${detailsRow("Emoção", order.emotion)}
      </table>`,
    button: { text: "💳 Ir para o pagamento", url: paymentUrl },
    note: { text: `Qualquer dúvida, fale com a gente no WhatsApp: <a href="https://wa.me/5511996645678" style="color:#ec4899;font-weight:bold">(11) 99664-5678</a>` },
  })
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
      subject: `[Admin] 💳 Pedido pago — ${order.nome} (${order.subcategory})`,
      html: emailShell({
        emoji: "💳",
        title: "Novo pedido pago!",
        body: adminRows([
          ["Pedido", `<span style="font-family:monospace;color:#ec4899">#${order.orderId.slice(0, 8).toUpperCase()}</span>`],
          ["Cliente", order.nome],
          ["E-mail", `<a href="mailto:${order.email}" style="color:#ec4899">${order.email}</a>`],
          ["WhatsApp", order.whatsapp],
          ...(order.honoreeName ? [["Homenageado", order.honoreeName] as [string, string]] : []),
          ["Ocasião", order.subcategory],
          ["Estilo", order.musicalStyle],
          ["Voz", order.voiceType],
          ["Emoção", order.emotion],
          ["Recebido em", new Date(order.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })],
        ]),
        button: { text: "Ver pedido no painel →", url: adminUrl },
      }),
    })
    console.log(`[email] Notificação de pagamento enviada para ${ADMIN_EMAIL}`)
  } catch (err) {
    console.error("[email] Falha ao notificar admin sobre pagamento:", err)
  }
}

// Alerta ao admin: no modo "com aprovação", a música ficou pronta (READY) e aguarda
// você clicar em "Liberar" na fila de Produção. Sem isso o admin ficava cego até abrir o painel.
export async function sendMusicReadyForReviewNotification(data: { orderId: string; nome: string; subcategory?: string | null }): Promise<void> {
  const adminUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://fizmusica.com.br"}/admin/producao`
  try {
    await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      ADMIN_REVIEW_EMAIL,
      subject: `[Admin] 🎵 Música pronta pra liberar — ${data.nome}`,
      html: emailShell({
        emoji: "🎵",
        title: "Música pronta para revisão",
        subtitle: "As versões foram geradas e aguardam sua liberação para o cliente.",
        body: adminRows([
          ["Pedido", `<span style="font-family:monospace;color:#ec4899">#${data.orderId.slice(0, 8).toUpperCase()}</span>`],
          ["Cliente", data.nome],
          ...(data.subcategory ? [["Ocasião", data.subcategory] as [string, string]] : []),
        ]),
        button: { text: "Abrir a fila de Produção →", url: adminUrl },
      }),
    })
    console.log(`[email] Alerta "pronta pra liberar" enviado para ${ADMIN_REVIEW_EMAIL}`)
  } catch (err) {
    console.error("[email] Falha ao notificar admin (pronta pra liberar):", err)
  }
}

function buildAdminEmail(order: OrderEmailData): string {
  return emailShell({
    emoji: "🆕",
    title: "Novo pedido recebido",
    body: adminRows([
      ["ID", `<span style="font-family:monospace;color:#ec4899">#${order.orderId.slice(0, 8).toUpperCase()}</span>`],
      ["Nome", order.nome],
      ["E-mail", `<a href="mailto:${order.email}" style="color:#ec4899">${order.email}</a>`],
      ["WhatsApp", order.whatsapp],
      ["Contexto", order.context],
      ["Ocasião", order.subcategory],
      ["Estilo", order.musicalStyle],
      ["Voz", order.voiceType],
      ["Emoção", order.emotion],
      ["Data", order.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })],
    ]),
  })
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
  coupon?:      { code: string; label: string } | null
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
  const couponBlock = data.coupon
    ? `<div style="margin:24px 0;padding:18px;border:2px dashed #ec4899;border-radius:14px;background:rgba(236,72,153,0.08);text-align:center">
         <p style="margin:0 0 6px;color:#f9a8d4;font-size:13px;font-weight:bold;letter-spacing:.05em">🎟️ ${data.coupon.label} PRA VOCÊ VOLTAR</p>
         <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:#fff;font-family:monospace;letter-spacing:.1em">${data.coupon.code}</p>
         <p style="margin:0;color:#cbd5e1;font-size:12px">Use este código no checkout ao finalizar.</p>
       </div>`
    : ""
  return emailShell({
    emoji: "🎵",
    title: "Sua música está esperando!",
    subtitle: "Você começou um pedido e não finalizou",
    body:
      para(`Olá, ${strong(data.nome.split(" ")[0])}! ❤️`) +
      para(`Notamos que você iniciou um pedido de ${strong(data.subcategory)} no estilo ${strong(data.musicalStyle)}, mas não concluiu o pagamento.`) +
      para(data.coupon
        ? "E pra te dar aquele empurrãozinho, separamos um desconto especial:"
        : "Sua música personalizada pode ser criada especialmente para você — basta finalizar o pedido!") +
      couponBlock,
    button: { text: "🎵 Finalizar meu pedido", url: `${siteUrl}/criar` },
    note: { text: `Dúvidas? Fale com a gente no WhatsApp: <a href="https://wa.me/5511996645678" style="color:#ec4899;font-weight:bold">📱 (11) 99664-5678</a>` },
  })
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
      subject: `${data.nome.split(" ")[0]}, como foi sua experiência com a FizMusica? ✨`,
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
  return emailShell({
    emoji: "💜",
    title: "Como foi sua experiência?",
    subtitle: "Sua opinião faz toda a diferença pra nós!",
    body:
      para(`Olá, ${strong(data.nome.split(" ")[0])}! 🎵`) +
      para(`Seu pedido ${strong(`"${data.musicName}"`)} foi entregue e esperamos que tenha sido uma experiência especial — da criação à entrega.`) +
      para("Queremos saber como foi pra você, do começo ao fim — leva menos de 2 minutos e nos ajuda muito a continuar melhorando cada detalhe."),
    button: { text: "⭐ Avaliar minha experiência", url: data.feedbackUrl },
    note: {
      label: "3 perguntinhas rápidas",
      text: "⭐ Nota geral de 1 a 5 estrelas<br>💬 O que mais te marcou na experiência<br>🔧 Sugestão de melhoria (opcional)",
    },
  })
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
